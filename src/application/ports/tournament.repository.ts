import { EntityId } from '../../domain/value-objects/entity-id';
import { Tournament } from '../../domain/entities/tournament';

/**
 * TournamentRepository: opera sobre el AGGREGATE ROOT completo.
 *
 * save() persiste el torneo Y todas sus rounds/matches/submissions en
 * cascada. findById() reconstruye el árbol completo. Esto respeta el
 * límite de consistencia del agregado: nadie debería guardar un Round o
 * un Match de forma aislada sin pasar por aquí, porque eso podría dejar
 * al torneo en un estado inconsistente (ej. dos rounds con el mismo order).
 */
export interface TournamentRepository {
  save(tournament: Tournament): Promise<void>;
  findById(id: EntityId): Promise<Tournament | null>;
  findAll(): Promise<Tournament[]>;
  /** Resuelve el torneo dueño de un match, sin que el caller conozca el tournamentId. */
  findByMatchId(matchId: EntityId): Promise<Tournament | null>;
}
