import { EntityId } from '../../domain/value-objects/entity-id';
import { QualifyingRound } from '../../domain/entities/qualifying-round';

export interface QualifyingRoundRepository {
  save(round: QualifyingRound, tournamentId: EntityId): Promise<void>;
  findByTournamentId(tournamentId: EntityId): Promise<QualifyingRound | null>;
}
