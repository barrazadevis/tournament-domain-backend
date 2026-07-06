import { EntityId } from '../../domain/value-objects/entity-id';
import { Submission } from '../../domain/entities/submission';
import { TournamentRepository } from '../ports/tournament.repository';

export interface SubmitMatchSolutionInput {
  matchId: string;
  teamId: string;
  content: string;
  submittedAt: Date;
}

export class SubmitMatchSolutionUseCase {
  constructor(private readonly tournamentRepository: TournamentRepository) {}

  async execute(input: SubmitMatchSolutionInput): Promise<void> {
    const matchId = EntityId.fromString(input.matchId);
    const tournament = await this.tournamentRepository.findByMatchId(matchId);
    if (!tournament) {
      throw new Error(`Match ${input.matchId} no encontrado`);
    }

    const match = tournament.findMatch(matchId)!;
    const submission = new Submission(
      EntityId.generate(),
      EntityId.fromString(input.teamId),
      input.content,
      input.submittedAt,
    );
    match.submitSolution(submission);

    await this.tournamentRepository.save(tournament);
  }
}
