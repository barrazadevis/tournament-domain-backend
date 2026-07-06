import { EntityId } from '../../domain/value-objects/entity-id';
import { TournamentRepository } from '../ports/tournament.repository';

export interface ResetTournamentInput {
  tournamentId: string;
}

/**
 * Vuelve un torneo a DRAFT, borrando rondas/matches/clasificatoria para
 * repetir la actividad desde cero con el mismo id/nombre. Ver el
 * doc-comment de TournamentRepository.reset() para por qué esto no pasa
 * por el ciclo normal de save().
 */
export class ResetTournamentUseCase {
  constructor(private readonly tournamentRepository: TournamentRepository) {}

  async execute(input: ResetTournamentInput): Promise<void> {
    const id = EntityId.fromString(input.tournamentId);
    const tournament = await this.tournamentRepository.findById(id);
    if (!tournament) {
      throw new Error(`Torneo ${input.tournamentId} no encontrado`);
    }

    await this.tournamentRepository.reset(id);
  }
}
