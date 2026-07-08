import { EntityId } from '../../domain/value-objects/entity-id';
import { TournamentRepository } from '../ports/tournament.repository';
import { CodeRunner } from '../ports/code-runner';
import { TournamentLanguage } from '../../domain/entities/tournament';
import { runCodeAgainstTestCases } from '../services/run-code-against-test-cases';

export interface RunSubmissionCodeInput {
  matchId: string;
  submissionId: string;
}

/**
 * Ejecuta el código de una submission YA CREADA contra los test cases del
 * caso, y anota el resultado. Se dispara fire-and-forget desde TeamGateway
 * después de que la submission ya fue aceptada — nunca bloquea ni puede
 * hacer fallar el envío real si Piston está caído (ver
 * updateSubmissionExecutionResult para el porqué de NO usar save() del
 * agregado completo aquí).
 */
export class RunSubmissionCodeUseCase {
  constructor(
    private readonly tournamentRepository: TournamentRepository,
    private readonly codeRunner: CodeRunner,
  ) {}

  async execute(input: RunSubmissionCodeInput): Promise<void> {
    const matchId = EntityId.fromString(input.matchId);
    const tournament = await this.tournamentRepository.findByMatchId(matchId);
    if (!tournament || tournament.getLanguage() !== TournamentLanguage.PYTHON) return;

    const match = tournament.findMatch(matchId);
    if (!match) return;

    const submissionId = EntityId.fromString(input.submissionId);
    const submission = match.getSubmissions().find((s) => s.getId().equals(submissionId));
    if (!submission) return;

    const result = await runCodeAgainstTestCases(
      this.codeRunner,
      tournament.getLanguage(),
      submission.getContent(),
      match.getBusinessCase().getTestCases(),
    );

    await this.tournamentRepository.updateSubmissionExecutionResult(submissionId, result);
  }
}
