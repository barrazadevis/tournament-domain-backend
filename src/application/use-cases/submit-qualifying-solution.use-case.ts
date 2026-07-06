import { EntityId } from '../../domain/value-objects/entity-id';
import { Submission } from '../../domain/entities/submission';
import { QualifyingRoundRepository } from '../ports/qualifying-round.repository';

export interface SubmitQualifyingSolutionInput {
  tournamentId: string;
  teamId: string;
  content: string;
  submittedAt: Date;
}

export class SubmitQualifyingSolutionUseCase {
  constructor(private readonly qualifyingRoundRepository: QualifyingRoundRepository) {}

  async execute(input: SubmitQualifyingSolutionInput): Promise<void> {
    const round = await this.qualifyingRoundRepository.findByTournamentId(
      EntityId.fromString(input.tournamentId),
    );
    if (!round) {
      throw new Error('No hay ronda clasificatoria activa para este torneo');
    }

    const submission = new Submission(
      EntityId.generate(),
      EntityId.fromString(input.teamId),
      input.content,
      input.submittedAt,
    );
    round.submit(submission);

    await this.qualifyingRoundRepository.save(round, EntityId.fromString(input.tournamentId));
  }
}
