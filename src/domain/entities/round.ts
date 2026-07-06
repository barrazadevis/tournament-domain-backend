import { EntityId } from '../value-objects/entity-id';
import { Match } from './match';

/**
 * Entidad Round: agrupa los matches de una fase del torneo.
 *
 * `order` determina la secuencia (0 = Cuartos, 1 = Semifinal, 2 = Final).
 * Gracias a QualifyingRound, el número de equipos que llega aquí siempre
 * es potencia de 2 — por eso Round ya no necesita modelar "byes": todo
 * slot es un Match real que se juega.
 */
export class Round {
  private readonly id: EntityId;
  private readonly name: string;
  private readonly order: number;
  private readonly matches: Match[] = [];

  constructor(id: EntityId, name: string, order: number) {
    this.id = id;
    this.name = name;
    this.order = order;
  }

  getId(): EntityId {
    return this.id;
  }

  getName(): string {
    return this.name;
  }

  getOrder(): number {
    return this.order;
  }

  addMatch(match: Match): void {
    this.matches.push(match);
  }

  getMatches(): ReadonlyArray<Match> {
    return this.matches;
  }

  isComplete(): boolean {
    return this.matches.length > 0 && this.matches.every((m) => m.getResolution() !== null);
  }

  hasAnyMatchWithoutWinner(): boolean {
    return this.matches.some((m) => m.getResolution() === 'NO_WINNER');
  }
}
