import { EntityId } from '../../domain/value-objects/entity-id';
import { TournamentRepository } from '../ports/tournament.repository';

export interface StartMatchInput {
  matchId: string;
  now: Date;
}

export interface StartMatchOutput {
  timerDurationSeconds: number;
}

export class StartMatchUseCase {
  constructor(private readonly tournamentRepository: TournamentRepository) {}

  async execute(input: StartMatchInput): Promise<StartMatchOutput> {
    const matchId = EntityId.fromString(input.matchId);
    const tournament = await this.tournamentRepository.findByMatchId(matchId);
    if (!tournament) {
      throw new Error(`Match ${input.matchId} no encontrado`);
    }

    const match = tournament.findMatch(matchId)!;
    match.start(input.now);
    await this.tournamentRepository.save(tournament);

    return { timerDurationSeconds: match.getTimerDurationSeconds() };
  }
}
