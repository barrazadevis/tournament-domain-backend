import { EntityId } from '../value-objects/entity-id';
import { Round } from './round';
import { Match } from './match';

export enum TournamentStatus {
  DRAFT = 'DRAFT', // Configurando equipos y casos
  QUALIFYING = 'QUALIFYING', // Ronda clasificatoria en curso (equipos no eran potencia de 2)
  IN_PROGRESS = 'IN_PROGRESS',
  FINISHED = 'FINISHED',
}

/**
 * Lenguaje del torneo completo (no por caso — un torneo = un curso = un
 * lenguaje, decisión explícita: no se mezclan dentro del mismo torneo).
 * PSEINT se juzga 100% manual como siempre; PYTHON habilita ejecución
 * automática contra casos de prueba vía Piston.
 */
export enum TournamentLanguage {
  PSEINT = 'PSEINT',
  PYTHON = 'PYTHON',
}

/**
 * Tournament: Aggregate Root. Es el único punto de entrada para modificar
 * el conjunto de rondas — nadie fuera del agregado debería mutar un Round
 * o un Match directamente sin pasar por aquí, para mantener consistencia
 * (ej. no se puede tener dos rondas con el mismo `order`).
 */
export class Tournament {
  private readonly id: EntityId;
  private name: string;
  private status: TournamentStatus = TournamentStatus.DRAFT;
  private readonly rounds: Round[] = [];
  private pendingCaseIds: EntityId[] = [];
  private language: TournamentLanguage = TournamentLanguage.PSEINT;

  constructor(id: EntityId, name: string) {
    if (!name.trim()) {
      throw new Error('El torneo debe tener nombre');
    }
    this.id = id;
    this.name = name.trim();
  }

  getId(): EntityId {
    return this.id;
  }

  getName(): string {
    return this.name;
  }

  rename(name: string): void {
    if (!name.trim()) {
      throw new Error('El torneo debe tener nombre');
    }
    this.name = name.trim();
  }

  getStatus(): TournamentStatus {
    return this.status;
  }

  addRound(round: Round): void {
    const duplicateOrder = this.rounds.some((r) => r.getOrder() === round.getOrder());
    if (duplicateOrder) {
      throw new Error(`Ya existe una ronda con order=${round.getOrder()}`);
    }
    this.rounds.push(round);
    this.rounds.sort((a, b) => a.getOrder() - b.getOrder());
  }

  getRounds(): ReadonlyArray<Round> {
    return this.rounds;
  }

  getRoundByOrder(order: number): Round | undefined {
    return this.rounds.find((r) => r.getOrder() === order);
  }

  /** Busca un match por id a través de todas las rondas del torneo. */
  findMatch(matchId: EntityId): Match | undefined {
    for (const round of this.rounds) {
      const match = round.getMatches().find((m) => m.getId().equals(matchId));
      if (match) return match;
    }
    return undefined;
  }

  getLatestRound(): Round | undefined {
    return this.rounds[this.rounds.length - 1];
  }

  start(): void {
    if (this.rounds.length === 0) {
      throw new Error('No se puede iniciar un torneo sin rondas configuradas');
    }
    this.status = TournamentStatus.IN_PROGRESS;
  }

  /**
   * Transición al arrancar la ronda clasificatoria (equipos no eran potencia
   * de 2). A diferencia de `start()`, todavía no hay ninguna Round creada
   * (esa se genera recién al cerrar la clasificatoria, ver
   * FinalizeQualifyingRoundUseCase) — por eso es un método separado en vez
   * de relajar el guard de `start()`.
   */
  enterQualifying(): void {
    if (this.status !== TournamentStatus.DRAFT) {
      throw new Error('El torneo ya fue iniciado');
    }
    this.status = TournamentStatus.QUALIFYING;
  }

  finish(): void {
    this.status = TournamentStatus.FINISHED;
  }

  /**
   * Vuelve el torneo a DRAFT descartando todo el progreso (rondas, matches,
   * clasificatoria) para repetir la actividad desde cero con el mismo id/nombre.
   * La persistencia real de esto (borrar filas de rondas/clasificatoria en la
   * base) vive en TournamentRepository.reset(), no aquí — este método solo
   * deja el agregado en memoria consistente con ese mismo estado.
   */
  resetToDraft(): void {
    this.rounds.length = 0;
    this.status = TournamentStatus.DRAFT;
    this.pendingCaseIds = [];
  }

  /**
   * Casos de negocio ya creados al iniciar el torneo, pendientes de
   * consumirse uno por ronda (`consumeNextCaseId()`) a medida que el
   * profesor avanza — así cada ronda tiene un caso distinto en vez de
   * reutilizar el de la ronda anterior. El primer caso (clasificatoria o
   * ronda inicial del bracket) NO pasa por aquí, se asigna directo al
   * iniciar; esto guarda solo el resto.
   */
  setPendingCaseIds(ids: EntityId[]): void {
    this.pendingCaseIds = [...ids];
  }

  getPendingCaseIds(): ReadonlyArray<EntityId> {
    return this.pendingCaseIds;
  }

  consumeNextCaseId(): EntityId {
    const next = this.pendingCaseIds.shift();
    if (!next) {
      throw new Error('No hay más casos planificados para las siguientes rondas');
    }
    return next;
  }

  getLanguage(): TournamentLanguage {
    return this.language;
  }

  /** Se fija una sola vez, al iniciar el torneo (ver StartTournamentUseCase). */
  setLanguage(language: TournamentLanguage): void {
    this.language = language;
  }

  static rehydrate(props: {
    id: EntityId;
    name: string;
    status: TournamentStatus;
    rounds: Round[];
    pendingCaseIds?: EntityId[];
    language?: TournamentLanguage;
  }): Tournament {
    const tournament = new Tournament(props.id, props.name);
    tournament.status = props.status;
    props.rounds.forEach((round) => tournament.rounds.push(round));
    tournament.rounds.sort((a, b) => a.getOrder() - b.getOrder());
    tournament.pendingCaseIds = props.pendingCaseIds ? [...props.pendingCaseIds] : [];
    tournament.language = props.language ?? TournamentLanguage.PSEINT;
    return tournament;
  }
}
