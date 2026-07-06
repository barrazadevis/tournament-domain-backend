import { EntityId } from '../../domain/value-objects/entity-id';
import { TournamentRepository } from '../ports/tournament.repository';

export interface JudgeMatchSubmissionInput {
  matchId: string;
  teamId: string;
  approve: boolean;
  now: Date;
}

export interface JudgeMatchSubmissionOutput {
  status: string;
  resolution: string | null;
}

export class JudgeMatchSubmissionUseCase {
  constructor(private readonly tournamentRepository: TournamentRepository) {}

  async execute(input: JudgeMatchSubmissionInput): Promise<JudgeMatchSubmissionOutput> {
    const matchId = EntityId.fromString(input.matchId);
    const tournament = await this.tournamentRepository.findByMatchId(matchId);
    if (!tournament) {
      throw new Error(`Match ${input.matchId} no encontrado`);
    }

    const match = tournament.findMatch(matchId)!;
    const teamId = EntityId.fromString(input.teamId);
    if (input.approve) {
      match.approveCurrentSubmission(teamId, input.now);
    } else {
      match.rejectCurrentSubmission(teamId, input.now);
    }

    await this.tournamentRepository.save(tournament);

    return { status: match.getStatus(), resolution: match.getResolution() };
  }
}
