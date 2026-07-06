import { EntityId } from '../value-objects/entity-id';
import { BusinessCase } from './business-case';
import { Submission } from './submission';
import { MatchStatus, MatchStateMachine } from '../services/match-state-machine';

export type MatchResolution = 'WINNER' | 'NO_WINNER';

/**
 * Entidad Match: un enfrentamiento 1v1 dentro de una ronda del torneo.
 *
 * Invariantes que esta clase protege (nunca pueden violarse desde afuera):
 * 1. Solo un equipo participante (teamA o teamB) puede enviar submissions.
 * 2. Un equipo descalificado en este match (submission rechazada) no puede
 *    volver a intentar.
 * 3. Solo puede haber UNA submission "bajo juicio" a la vez.
 * 4. Toda transición de estado pasa por MatchStateMachine.
 */
export class Match {
  private readonly id: EntityId;
  private readonly roundName: string;
  private readonly teamAId: EntityId;
  private readonly teamBId: EntityId;
  private readonly businessCase: BusinessCase;
  private readonly timerDurationSeconds: number;

  private status: MatchStatus = MatchStatus.PENDING;
  private timerStartedAt: Date | null = null;
  private readonly submissions: Submission[] = [];
  private readonly disqualifiedTeamIds: Set<string> = new Set();
  private winnerId: EntityId | null = null;
  private resolution: MatchResolution | null = null;

  constructor(
    id: EntityId,
    roundName: string,
    teamAId: EntityId,
    teamBId: EntityId,
    businessCase: BusinessCase,
    timerDurationSeconds: number,
  ) {
    if (teamAId.equals(teamBId)) {
      throw new Error('Un equipo no puede enfrentarse a sí mismo');
    }
    if (timerDurationSeconds <= 0) {
      throw new Error('La duración del timer debe ser positiva');
    }
    this.id = id;
    this.roundName = roundName;
    this.teamAId = teamAId;
    this.teamBId = teamBId;
    this.businessCase = businessCase;
    this.timerDurationSeconds = timerDurationSeconds;
  }

  getId(): EntityId {
    return this.id;
  }

  getStatus(): MatchStatus {
    return this.status;
  }

  getRoundName(): string {
    return this.roundName;
  }

  getBusinessCase(): BusinessCase {
    return this.businessCase;
  }

  getWinnerId(): EntityId | null {
    return this.winnerId;
  }

  getResolution(): MatchResolution | null {
    return this.resolution;
  }

  getTimerDurationSeconds(): number {
    return this.timerDurationSeconds;
  }

  getTimerStartedAt(): Date | null {
    return this.timerStartedAt;
  }

  getTeamAId(): EntityId {
    return this.teamAId;
  }

  getTeamBId(): EntityId {
    return this.teamBId;
  }

  getSubmissions(): ReadonlyArray<Submission> {
    return this.submissions;
  }

  getDisqualifiedTeamIds(): ReadonlyArray<string> {
    return [...this.disqualifiedTeamIds];
  }

  includesTeam(teamId: EntityId): boolean {
    return this.teamAId.equals(teamId) || this.teamBId.equals(teamId);
  }

  getOpponentOf(teamId: EntityId): EntityId {
    if (this.teamAId.equals(teamId)) return this.teamBId;
    if (this.teamBId.equals(teamId)) return this.teamAId;
    throw new Error('El equipo no participa en este match');
  }

  /** Inicia el match: arranca el timer y lo pasa a ACTIVE. */
  start(now: Date): void {
    MatchStateMachine.assertValidTransition(this.status, MatchStatus.ACTIVE);
    this.status = MatchStatus.ACTIVE;
    this.timerStartedAt = now;
  }

  /**
   * Un equipo envía su solución. Solo posible si:
   * - el match está ACTIVE (no ya bajo juicio ni resuelto)
   * - el equipo pertenece al match
   * - el equipo no fue descalificado previamente en este match
   */
  submitSolution(submission: Submission): void {
    MatchStateMachine.assertValidTransition(this.status, MatchStatus.AWAITING_JUDGMENT);

    if (!this.includesTeam(submission.getTeamId())) {
      throw new Error('Este equipo no participa en el match');
    }
    if (this.disqualifiedTeamIds.has(submission.getTeamId().toString())) {
      throw new Error('Este equipo ya fue descalificado en este match y no puede reintentar');
    }

    this.submissions.push(submission);
    this.status = MatchStatus.AWAITING_JUDGMENT;
  }

  private getSubmissionUnderJudgment(): Submission {
    const pending = this.submissions.find((s) => s.isPending());
    if (!pending) {
      throw new Error('No hay ninguna submission pendiente de juicio');
    }
    return pending;
  }

  /**
   * El juez aprueba la submission actual: el match se resuelve con ganador.
   */
  approveCurrentSubmission(now: Date): void {
    const submission = this.getSubmissionUnderJudgment();
    submission.approve(now);

    MatchStateMachine.assertValidTransition(this.status, MatchStatus.RESOLVED);
    this.status = MatchStatus.RESOLVED;
    this.winnerId = submission.getTeamId();
    this.resolution = 'WINNER';
  }

  /**
   * El juez rechaza la submission actual: el equipo queda descalificado
   * de este match y, si el rival aún no fue descalificado, el match vuelve
   * a ACTIVE para darle su oportunidad.
   */
  rejectCurrentSubmission(now: Date): void {
    const submission = this.getSubmissionUnderJudgment();
    submission.reject(now);
    this.disqualifiedTeamIds.add(submission.getTeamId().toString());

    const opponentId = this.getOpponentOf(submission.getTeamId());
    const opponentAlreadyDisqualified = this.disqualifiedTeamIds.has(opponentId.toString());

    if (opponentAlreadyDisqualified) {
      // Ambos equipos fallaron: el match cierra sin ganador.
      MatchStateMachine.assertValidTransition(this.status, MatchStatus.RESOLVED);
      this.status = MatchStatus.RESOLVED;
      this.resolution = 'NO_WINNER';
    } else {
      MatchStateMachine.assertValidTransition(this.status, MatchStatus.ACTIVE);
      this.status = MatchStatus.ACTIVE;
    }
  }

  /**
   * El timer expiró sin que nadie enviara solución: el match cierra sin
   * ganador. Solo aplica si el match seguía ACTIVE (si ya hay alguien bajo
   * juicio, el timer no debe cortar el proceso de evaluación del juez).
   */
  expireTimer(): void {
    if (this.status !== MatchStatus.ACTIVE) {
      return; // No-op: el timer expirado no afecta un match ya en juicio o resuelto
    }
    MatchStateMachine.assertValidTransition(this.status, MatchStatus.RESOLVED);
    this.status = MatchStatus.RESOLVED;
    this.resolution = 'NO_WINNER';
  }

  hasElapsedTimerDuration(now: Date): boolean {
    if (!this.timerStartedAt) return false;
    const elapsedSeconds = (now.getTime() - this.timerStartedAt.getTime()) / 1000;
    return elapsedSeconds >= this.timerDurationSeconds;
  }

  /**
   * Reconstruye un Match desde datos persistidos, en el estado exacto en que
   * quedó guardado (status, submissions, descalificados, ganador). No pasa
   * por start()/submitSolution()/approveCurrentSubmission() porque esos
   * métodos validan TRANSICIONES nuevas — aquí solo restauramos un estado
   * que ya fue válido cuando se guardó.
   */
  static rehydrate(props: {
    id: EntityId;
    roundName: string;
    teamAId: EntityId;
    teamBId: EntityId;
    businessCase: BusinessCase;
    timerDurationSeconds: number;
    status: MatchStatus;
    timerStartedAt: Date | null;
    submissions: Submission[];
    disqualifiedTeamIds: string[];
    winnerId: EntityId | null;
    resolution: MatchResolution | null;
  }): Match {
    const match = new Match(
      props.id,
      props.roundName,
      props.teamAId,
      props.teamBId,
      props.businessCase,
      props.timerDurationSeconds,
    );
    match.status = props.status;
    match.timerStartedAt = props.timerStartedAt;
    match.submissions.push(...props.submissions);
    props.disqualifiedTeamIds.forEach((id) => match.disqualifiedTeamIds.add(id));
    match.winnerId = props.winnerId;
    match.resolution = props.resolution;
    return match;
  }
}
