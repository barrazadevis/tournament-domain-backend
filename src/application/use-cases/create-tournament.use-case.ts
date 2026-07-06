import { EntityId } from '../../domain/value-objects/entity-id';
import { Tournament } from '../../domain/entities/tournament';
import { TournamentRepository } from '../ports/tournament.repository';

export interface CreateTournamentInput {
  name: string;
}

export class CreateTournamentUseCase {
  constructor(private readonly tournamentRepository: TournamentRepository) {}

  async execute(input: CreateTournamentInput): Promise<Tournament> {
    const tournament = new Tournament(EntityId.generate(), input.name);
    await this.tournamentRepository.save(tournament);
    return tournament;
  }
}
