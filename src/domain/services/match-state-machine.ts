export enum MatchStatus {
  PENDING = 'PENDING', // Creado, esperando a que el juez inicie el timer
  ACTIVE = 'ACTIVE', // Timer corriendo, equipos pueden enviar solución
  AWAITING_JUDGMENT = 'AWAITING_JUDGMENT', // Alguien envió, el juez debe decidir
  RESOLVED = 'RESOLVED', // Match cerrado (con o sin ganador)
}

/**
 * MatchStateMachine: única fuente de verdad sobre qué transiciones de
 * estado son válidas para un Match.
 *
 * Por qué está separado del Match: Single Responsibility. Match gestiona
 * SUS DATOS (equipos, caso, submissions); esta clase gestiona SOLO las
 * reglas de transición. Si mañana cambian las reglas del torneo (ej. se
 * permite pausar un match), se toca esta clase y no Match.
 */
export class MatchStateMachine {
  private static readonly ALLOWED_TRANSITIONS: Record<MatchStatus, MatchStatus[]> = {
    [MatchStatus.PENDING]: [MatchStatus.ACTIVE],
    [MatchStatus.ACTIVE]: [MatchStatus.AWAITING_JUDGMENT, MatchStatus.RESOLVED],
    [MatchStatus.AWAITING_JUDGMENT]: [MatchStatus.ACTIVE, MatchStatus.RESOLVED],
    [MatchStatus.RESOLVED]: [],
  };

  static assertValidTransition(from: MatchStatus, to: MatchStatus): void {
    const allowedTargets = this.ALLOWED_TRANSITIONS[from];
    if (!allowedTargets.includes(to)) {
      throw new InvalidMatchTransitionError(from, to);
    }
  }

  static canTransition(from: MatchStatus, to: MatchStatus): boolean {
    return this.ALLOWED_TRANSITIONS[from].includes(to);
  }
}

export class InvalidMatchTransitionError extends Error {
  constructor(from: MatchStatus, to: MatchStatus) {
    super(`Transición inválida de match: no se puede pasar de ${from} a ${to}`);
    this.name = 'InvalidMatchTransitionError';
  }
}
