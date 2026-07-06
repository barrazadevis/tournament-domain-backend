import { EntityId } from '../../domain/value-objects/entity-id';
import { TournamentRepository } from '../ports/tournament.repository';

export interface DeleteTournamentInput {
  tournamentId: string;
}

export class DeleteTournamentUseCase {
  constructor(private readonly tournamentRepository: TournamentRepository) {}

  async execute(input: DeleteTournamentInput): Promise<void> {
    const id = EntityId.fromString(input.tournamentId);
    const tournament = await this.tournamentRepository.findById(id);
    if (!tournament) {
      throw new Error(`Torneo ${input.tournamentId} no encontrado`);
    }

    await this.tournamentRepository.delete(id);
  }
}
