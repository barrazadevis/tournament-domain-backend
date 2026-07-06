import { EntityId } from '../value-objects/entity-id';

export enum VerdictStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

/**
 * Entidad Submission: la respuesta que un equipo envía para un match
 * (estructura repetitiva + pseudocódigo + justificación de negocio).
 *
 * Inmutable en su contenido una vez creada: si el equipo quiere corregir
 * tras un rechazo, se crea una NUEVA Submission, no se edita la anterior.
 * Esto nos da trazabilidad completa de cada intento (útil para el profesor
 * y para el reporte final del torneo).
 */
export class Submission {
  private readonly id: EntityId;
  private readonly teamId: EntityId;
  private readonly content: string;
  private readonly submittedAt: Date;
  private verdict: VerdictStatus;
  private judgedAt: Date | null = null;

  constructor(id: EntityId, teamId: EntityId, content: string, submittedAt: Date) {
    if (!content || content.trim().length === 0) {
      throw new Error('La submission no puede estar vacía');
    }
    this.id = id;
    this.teamId = teamId;
    this.content = content;
    this.submittedAt = submittedAt;
    this.verdict = VerdictStatus.PENDING;
  }

  getId(): EntityId {
    return this.id;
  }

  getTeamId(): EntityId {
    return this.teamId;
  }

  getContent(): string {
    return this.content;
  }

  getSubmittedAt(): Date {
    return this.submittedAt;
  }

  getVerdict(): VerdictStatus {
    return this.verdict;
  }

  isPending(): boolean {
    return this.verdict === VerdictStatus.PENDING;
  }

  approve(judgedAt: Date): void {
    this.assertIsPending();
    this.verdict = VerdictStatus.APPROVED;
    this.judgedAt = judgedAt;
  }

  reject(judgedAt: Date): void {
    this.assertIsPending();
    this.verdict = VerdictStatus.REJECTED;
    this.judgedAt = judgedAt;
  }

  getJudgedAt(): Date | null {
    return this.judgedAt;
  }

  private assertIsPending(): void {
    if (this.verdict !== VerdictStatus.PENDING) {
      throw new Error(
        `No se puede juzgar una submission que ya tiene veredicto: ${this.verdict}`,
      );
    }
  }

  /**
   * Reconstruye una Submission desde datos ya persistidos, con un verdicto
   * que puede no ser PENDING. NO pasa por approve()/reject() porque esos
   * métodos son para transiciones de negocio nuevas, no para restaurar un
   * estado que ya fue válido en el pasado.
   */
  static rehydrate(props: {
    id: EntityId;
    teamId: EntityId;
    content: string;
    submittedAt: Date;
    verdict: VerdictStatus;
    judgedAt: Date | null;
  }): Submission {
    const submission = new Submission(props.id, props.teamId, props.content, props.submittedAt);
    submission.verdict = props.verdict;
    submission.judgedAt = props.judgedAt;
    return submission;
  }
}
