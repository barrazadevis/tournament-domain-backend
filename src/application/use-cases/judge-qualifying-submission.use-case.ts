import { EntityId } from '../../domain/value-objects/entity-id';
import { QualifyingRoundRepository } from '../ports/qualifying-round.repository';

export interface JudgeQualifyingSubmissionInput {
  tournamentId: string;
  teamId: string;
  approve: boolean;
  now: Date;
}

export class JudgeQualifyingSubmissionUseCase {
  constructor(private readonly qualifyingRoundRepository: QualifyingRoundRepository) {}

  async execute(input: JudgeQualifyingSubmissionInput): Promise<void> {
    const round = await this.qualifyingRoundRepository.findByTournamentId(
      EntityId.fromString(input.tournamentId),
    );
    if (!round) {
      throw new Error('No hay ronda clasificatoria activa para este torneo');
    }

    const teamId = EntityId.fromString(input.teamId);
    if (input.approve) {
      round.approveSubmission(teamId, input.now);
    } else {
      round.rejectSubmission(teamId, input.now);
    }

    await this.qualifyingRoundRepository.save(round, EntityId.fromString(input.tournamentId));
  }
}
