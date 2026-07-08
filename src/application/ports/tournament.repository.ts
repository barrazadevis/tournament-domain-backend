import { EntityId } from '../../domain/value-objects/entity-id';
import { Tournament } from '../../domain/entities/tournament';
import { ExecutionResult } from '../../domain/entities/submission';

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
  /** Elimina el torneo y todo lo que dependa de él (rondas, matches, clasificatoria) en cascada. */
  delete(id: EntityId): Promise<void>;
  /**
   * Borra rondas/matches/clasificatoria del torneo y lo regresa a DRAFT,
   * conservando id y nombre. No pasa por save() porque ese método solo
   * hace upsert de lo que trae el agregado en memoria — nunca borra rondas
   * que ya no estén ahí — así que reset() necesita su propio DELETE.
   */
  reset(id: EntityId): Promise<void>;
  /**
   * UPDATE angosto de una sola submission — deliberadamente NO pasa por
   * save() del agregado completo (ver implementación SQLite para el porqué:
   * evita una condición de carrera real con submissions concurrentes).
   */
  updateSubmissionExecutionResult(submissionId: EntityId, result: ExecutionResult): Promise<void>;
}
