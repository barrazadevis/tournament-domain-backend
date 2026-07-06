import { EntityId } from '../../domain/value-objects/entity-id';
import { TournamentRepository } from '../ports/tournament.repository';

export interface RestartMatchInput {
  matchId: string;
}

/**
 * Repite un match individual desde cero — solo válido si terminó sin
 * ganador y nadie envió nada (ver Match.restart() para la regla exacta).
 * No requiere reiniciar el torneo completo ni afecta otras rondas/matches.
 */
export class RestartMatchUseCase {
  constructor(private readonly tournamentRepository: TournamentRepository) {}

  async execute(input: RestartMatchInput): Promise<void> {
    const matchId = EntityId.fromString(input.matchId);
    const tournament = await this.tournamentRepository.findByMatchId(matchId);
    if (!tournament) {
      throw new Error(`Match ${input.matchId} no encontrado`);
    }

    const match = tournament.findMatch(matchId)!;
    match.restart();

    await this.tournamentRepository.save(tournament);
  }
}
