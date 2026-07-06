import { EntityId } from '../value-objects/entity-id';
import { Team } from './team';
import { BusinessCase } from './business-case';
import { Submission, VerdictStatus } from './submission';
import { PowerOfTwoMath } from '../services/power-of-two-math';

export class DuplicateSubmissionError extends Error {
  constructor() {
    super('Este equipo ya envió su solución en la ronda clasificatoria');
    this.name = 'DuplicateSubmissionError';
  }
}

export class QualifyingRoundNotFinishedError extends Error {
  constructor() {
    super('No se pueden calcular los clasificados: aún hay submissions sin juzgar');
    this.name = 'QualifyingRoundNotFinishedError';
  }
}

/**
 * QualifyingRound: ronda previa al bracket principal, usada solo cuando el
 * número de equipos inscritos no es potencia de 2.
 *
 * A diferencia de Match (1 vs 1), aquí TODOS los equipos reciben el mismo
 * caso al mismo tiempo. Nadie pasa sin competir — cada equipo entrega su
 * propia submission. El profesor juzga cada una igual que en un Match
 * normal (correcta/incorrecta). Entre las APROBADAS, se ordenan por
 * timestamp de envío, y avanzan las N más rápidas necesarias para llegar
 * a la potencia de 2 inferior más cercana.
 */
export class QualifyingRound {
  private readonly id: EntityId;
  private readonly participantTeamIds: ReadonlySet<string>;
  private readonly businessCase: BusinessCase;
  private readonly timerDurationSeconds: number;
  private readonly submissions: Submission[] = [];

  constructor(
    id: EntityId,
    teams: Team[],
    businessCase: BusinessCase,
    timerDurationSeconds: number,
  ) {
    if (teams.length < 2) {
      throw new Error('Se necesitan al menos 2 equipos para una ronda clasificatoria');
    }
    if (PowerOfTwoMath.isPowerOfTwo(teams.length)) {
      throw new Error(
        'No hace falta ronda clasificatoria: el número de equipos ya es potencia de 2',
      );
    }
    this.id = id;
    this.participantTeamIds = new Set(teams.map((t) => t.getId().toString()));
    this.businessCase = businessCase;
    this.timerDurationSeconds = timerDurationSeconds;
  }

  getId(): EntityId {
    return this.id;
  }

  getBusinessCase(): BusinessCase {
    return this.businessCase;
  }

  getTimerDurationSeconds(): number {
    return this.timerDurationSeconds;
  }

  /** Cuántos equipos deben avanzar al bracket principal. */
  getTargetQualifierCount(): number {
    return PowerOfTwoMath.largestPowerOfTwoLessOrEqual(this.participantTeamIds.size);
  }

  getParticipantTeamIds(): ReadonlyArray<string> {
    return [...this.participantTeamIds];
  }

  getSubmissions(): ReadonlyArray<Submission> {
    return this.submissions;
  }

  submit(submission: Submission): void {
    if (!this.participantTeamIds.has(submission.getTeamId().toString())) {
      throw new Error('Este equipo no participa en la ronda clasificatoria');
    }
    const alreadySubmitted = this.submissions.some((s) =>
      s.getTeamId().equals(submission.getTeamId()),
    );
    if (alreadySubmitted) {
      throw new DuplicateSubmissionError();
    }
    this.submissions.push(submission);
  }

  approveSubmission(teamId: EntityId, now: Date): void {
    this.findSubmissionOf(teamId).approve(now);
  }

  rejectSubmission(teamId: EntityId, now: Date): void {
    this.findSubmissionOf(teamId).reject(now);
  }

  private findSubmissionOf(teamId: EntityId): Submission {
    const submission = this.submissions.find((s) => s.getTeamId().equals(teamId));
    if (!submission) {
      throw new Error('Este equipo no ha enviado ninguna submission');
    }
    return submission;
  }

  private isFullyJudged(): boolean {
    return (
      this.submissions.length === this.participantTeamIds.size &&
      this.submissions.every((s) => !s.isPending())
    );
  }

  /**
   * Devuelve los ids de los equipos que avanzan al bracket principal:
   * las submissions APROBADAS ordenadas por tiempo de envío ascendente
   * (más rápido primero), tomando las primeras `getTargetQualifierCount()`.
   *
   * Equipos con submission rechazada, o que no llegaron a enviar antes
   * de que el juez cierre la ronda, quedan eliminados.
   */
  computeQualifiers(): EntityId[] {
    if (!this.isFullyJudged()) {
      throw new QualifyingRoundNotFinishedError();
    }

    const approved = this.submissions
      .filter((s) => s.getVerdict() === VerdictStatus.APPROVED)
      .sort((a, b) => a.getSubmittedAt().getTime() - b.getSubmittedAt().getTime());

    return approved.slice(0, this.getTargetQualifierCount()).map((s) => s.getTeamId());
  }

  /**
   * Reconstruye desde persistencia. Reutiliza el constructor normal (con
   * los mismos equipos originales, ya cargados por el repositorio vía
   * TeamRepository) para no tener que tocar el campo readonly
   * `participantTeamIds` desde afuera — solo restaura las submissions.
   */
  static rehydrate(props: {
    id: EntityId;
    teams: Team[];
    businessCase: BusinessCase;
    timerDurationSeconds: number;
    submissions: Submission[];
  }): QualifyingRound {
    const round = new QualifyingRound(
      props.id,
      props.teams,
      props.businessCase,
      props.timerDurationSeconds,
    );
    round.submissions.push(...props.submissions);
    return round;
  }
}
