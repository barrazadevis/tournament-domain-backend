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
 * 3. Un equipo no puede tener más de una submission propia bajo juicio a
 *    la vez — pero AMBOS equipos SÍ pueden tener, cada uno, una submission
 *    pendiente simultáneamente (decisión de negocio: así el juez puede
 *    revisar la del rival sin esperar a que la primera sea rechazada).
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
   * - el match no está RESOLVED
   * - el equipo pertenece al match
   * - el equipo no fue descalificado previamente en este match
   * - ESE equipo no tiene ya una submission propia pendiente de juicio
   *   (el rival sí puede tener la suya pendiente al mismo tiempo — ver
   *   invariante 3 en el doc-comment de la clase).
   */
  submitSolution(submission: Submission): void {
    const teamId = submission.getTeamId();

    if (!this.includesTeam(teamId)) {
      throw new Error('Este equipo no participa en el match');
    }
    if (this.disqualifiedTeamIds.has(teamId.toString())) {
      throw new Error('Este equipo ya fue descalificado en este match y no puede reintentar');
    }
    if (this.status === MatchStatus.RESOLVED) {
      throw new Error('El match ya terminó');
    }
    if (this.hasPendingSubmissionFrom(teamId)) {
      throw new Error('Ya tienes una solución pendiente de revisión en este match');
    }

    // AWAITING_JUDGMENT -> AWAITING_JUDGMENT es válido aquí: el rival ya
    // tiene una submission pendiente y este equipo agrega la suya, sin
    // que una bloquee a la otra. Si el match seguía ACTIVE, sí es una
    // transición real y pasa por la máquina de estados.
    if (this.status !== MatchStatus.AWAITING_JUDGMENT) {
      MatchStateMachine.assertValidTransition(this.status, MatchStatus.AWAITING_JUDGMENT);
      this.status = MatchStatus.AWAITING_JUDGMENT;
    }

    this.submissions.push(submission);
  }

  private hasPendingSubmissionFrom(teamId: EntityId): boolean {
    return this.submissions.some((s) => s.getTeamId().equals(teamId) && s.isPending());
  }

  private hasAnySubmissionFrom(teamId: EntityId): boolean {
    return this.submissions.some((s) => s.getTeamId().equals(teamId));
  }

  /**
   * true si algún equipo todavía podría enviar una submission (no está
   * descalificado y no ha enviado ya la suya en este match). Se usa para
   * decidir si el timer server-side debe seguir corriendo: una vez que
   * NINGÚN equipo puede enviar más, seguir contando no tiene sentido —
   * lo único que falta es el veredicto del juez.
   */
  canAnyTeamStillSubmit(): boolean {
    return [this.teamAId, this.teamBId].some(
      (teamId) => !this.disqualifiedTeamIds.has(teamId.toString()) && !this.hasAnySubmissionFrom(teamId),
    );
  }

  private getPendingSubmissionFrom(teamId: EntityId): Submission {
    const pending = this.submissions.find((s) => s.getTeamId().equals(teamId) && s.isPending());
    if (!pending) {
      throw new Error('Este equipo no tiene ninguna submission pendiente de juicio');
    }
    return pending;
  }

  /**
   * El juez aprueba la submission de `teamId`: el match se resuelve con
   * ese equipo como ganador. Si el rival también tenía una submission
   * pendiente, queda sin juzgar — el match ya cerró (decisión de negocio).
   */
  approveCurrentSubmission(teamId: EntityId, now: Date): void {
    if (this.status === MatchStatus.RESOLVED) {
      throw new Error('El match ya terminó');
    }
    const submission = this.getPendingSubmissionFrom(teamId);
    submission.approve(now);

    MatchStateMachine.assertValidTransition(this.status, MatchStatus.RESOLVED);
    this.status = MatchStatus.RESOLVED;
    this.winnerId = submission.getTeamId();
    this.resolution = 'WINNER';
  }

  /**
   * El juez rechaza la submission de `teamId`: ese equipo queda
   * descalificado de este match. Luego:
   * - si el rival también ya está descalificado, el match cierra sin ganador.
   * - si el rival tiene una submission pendiente (la envió en paralelo),
   *   el match se queda en AWAITING_JUDGMENT — todavía falta juzgarla.
   * - si no, el match vuelve a ACTIVE para darle su oportunidad al rival.
   */
  rejectCurrentSubmission(teamId: EntityId, now: Date): void {
    if (this.status === MatchStatus.RESOLVED) {
      throw new Error('El match ya terminó');
    }
    const submission = this.getPendingSubmissionFrom(teamId);
    submission.reject(now);
    this.disqualifiedTeamIds.add(teamId.toString());

    const opponentId = this.getOpponentOf(teamId);
    const opponentAlreadyDisqualified = this.disqualifiedTeamIds.has(opponentId.toString());

    if (opponentAlreadyDisqualified) {
      // Ambos equipos fallaron: el match cierra sin ganador.
      MatchStateMachine.assertValidTransition(this.status, MatchStatus.RESOLVED);
      this.status = MatchStatus.RESOLVED;
      this.resolution = 'NO_WINNER';
    } else if (!this.hasPendingSubmissionFrom(opponentId)) {
      MatchStateMachine.assertValidTransition(this.status, MatchStatus.ACTIVE);
      this.status = MatchStatus.ACTIVE;
    }
    // else: el rival ya tiene su propia submission pendiente — el match
    // se queda en AWAITING_JUDGMENT (no-op), el juez todavía debe revisarla.
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

  /**
   * Repite el match desde cero: solo permitido si terminó sin ganador y
   * NINGÚN equipo llegó a enviar nada (silencio total por timeout). Si
   * hubo intentos que fueron rechazados, ya usaron su oportunidad — no
   * aplica (decisión de negocio explícita, no se repite un match "perdido").
   */
  restart(): void {
    if (this.status !== MatchStatus.RESOLVED || this.resolution !== 'NO_WINNER') {
      throw new Error('Solo se puede repetir un match que terminó sin ganador');
    }
    if (this.submissions.length > 0) {
      throw new Error('No se puede repetir: hubo equipos que sí enviaron solución');
    }

    this.status = MatchStatus.PENDING;
    this.timerStartedAt = null;
    this.resolution = null;
    this.disqualifiedTeamIds.clear();
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
