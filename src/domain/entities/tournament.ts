import { EntityId } from '../value-objects/entity-id';
import { Round } from './round';
import { Match } from './match';

export enum TournamentStatus {
  DRAFT = 'DRAFT', // Configurando equipos y casos
  IN_PROGRESS = 'IN_PROGRESS',
  FINISHED = 'FINISHED',
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
  }

  static rehydrate(props: {
    id: EntityId;
    name: string;
    status: TournamentStatus;
    rounds: Round[];
  }): Tournament {
    const tournament = new Tournament(props.id, props.name);
    tournament.status = props.status;
    props.rounds.forEach((round) => tournament.rounds.push(round));
    tournament.rounds.sort((a, b) => a.getOrder() - b.getOrder());
    return tournament;
  }
}
