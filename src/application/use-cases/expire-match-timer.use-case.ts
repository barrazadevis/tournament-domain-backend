import { EntityId } from '../../domain/value-objects/entity-id';
import { TournamentRepository } from '../ports/tournament.repository';

export interface ExpireMatchTimerInput {
  matchId: string;
}

/**
 * ExpireMatchTimerUseCase: dispara cuando el timer de un match llega a 0
 * sin que nadie haya enviado solución. Toda la regla de negocio ya vive en
 * Match.expireTimer() (Fase 1) — este caso de uso solo la conecta con la
 * persistencia, igual que StartMatchUseCase.
 */
export class ExpireMatchTimerUseCase {
  constructor(private readonly tournamentRepository: TournamentRepository) {}

  async execute(input: ExpireMatchTimerInput): Promise<void> {
    const matchId = EntityId.fromString(input.matchId);
    const tournament = await this.tournamentRepository.findByMatchId(matchId);
    if (!tournament) {
      throw new Error(`Match ${input.matchId} no encontrado`);
    }

    const match = tournament.findMatch(matchId)!;
    match.expireTimer();
    await this.tournamentRepository.save(tournament);
  }
}
