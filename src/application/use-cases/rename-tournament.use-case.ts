import { EntityId } from '../../domain/value-objects/entity-id';
import { Tournament } from '../../domain/entities/tournament';
import { TournamentRepository } from '../ports/tournament.repository';

export interface RenameTournamentInput {
  tournamentId: string;
  name: string;
}

export class RenameTournamentUseCase {
  constructor(private readonly tournamentRepository: TournamentRepository) {}

  async execute(input: RenameTournamentInput): Promise<Tournament> {
    const tournament = await this.tournamentRepository.findById(EntityId.fromString(input.tournamentId));
    if (!tournament) {
      throw new Error(`Torneo ${input.tournamentId} no encontrado`);
    }

    tournament.rename(input.name);
    await this.tournamentRepository.save(tournament);
    return tournament;
  }
}
