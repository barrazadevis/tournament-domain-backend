import { EntityId } from '../../domain/value-objects/entity-id';
import { TournamentRepository } from '../ports/tournament.repository';
import { CodeRunner } from '../ports/code-runner';
import { TournamentLanguage } from '../../domain/entities/tournament';
import { MatchStatus } from '../../domain/services/match-state-machine';
import { ExecutionResult } from '../../domain/entities/submission';
import { runCodeAgainstTestCases } from '../services/run-code-against-test-cases';

export interface TestCodeInput {
  matchId: string;
  code: string;
}

/**
 * "Probar código": corrida sin persistir, para que el equipo itere antes de
 * enviar su solución oficial. Devuelve el detalle completo (incluye
 * expected/actual en fallos) — la protección contra "hardcodear la
 * respuesta" es exigir ≥2 test cases con inputs distintos al crear el caso
 * (ver StartTournamentUseCase), no ocultar el resultado.
 */
export class TestCodeUseCase {
  constructor(
    private readonly tournamentRepository: TournamentRepository,
    private readonly codeRunner: CodeRunner,
  ) {}

  async execute(input: TestCodeInput): Promise<ExecutionResult> {
    const matchId = EntityId.fromString(input.matchId);
    const tournament = await this.tournamentRepository.findByMatchId(matchId);
    if (!tournament) {
      throw new Error(`Match ${input.matchId} no encontrado`);
    }
    if (tournament.getLanguage() !== TournamentLanguage.PYTHON) {
      throw new Error('Este torneo no usa ejecución automática de código');
    }

    const match = tournament.findMatch(matchId)!;
    if (match.getStatus() !== MatchStatus.ACTIVE) {
      throw new Error('Solo se puede probar código mientras el match está en curso');
    }

    return runCodeAgainstTestCases(
      this.codeRunner,
      tournament.getLanguage(),
      input.code,
      match.getBusinessCase().getTestCases(),
    );
  }
}
