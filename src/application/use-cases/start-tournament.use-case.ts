import { EntityId } from '../../domain/value-objects/entity-id';
import { BusinessCase, BusinessCaseTestCase, RequiredStructureType } from '../../domain/entities/business-case';
import { QualifyingRound } from '../../domain/entities/qualifying-round';
import { TournamentLanguage, TournamentStatus } from '../../domain/entities/tournament';
import { PowerOfTwoMath } from '../../domain/services/power-of-two-math';
import { BracketGenerationService } from '../../domain/services/bracket-generation.service';
import { TournamentRepository } from '../ports/tournament.repository';
import { TeamRepository } from '../ports/team.repository';
import { BusinessCaseRepository } from '../ports/business-case.repository';
import { QualifyingRoundRepository } from '../ports/qualifying-round.repository';

/** Mínimo de test cases exigido por caso en torneos Python — con 1 solo, un equipo podría hardcodear la salida esperada sin resolver nada; con 2+ inputs distintos ya no alcanza con eso. */
const MIN_TEST_CASES_FOR_PYTHON = 2;

export interface StartTournamentCaseInput {
  title: string;
  description: string;
  testCases?: BusinessCaseTestCase[];
}

export interface StartTournamentInput {
  tournamentId: string;
  teamIds: string[];
  cases: StartTournamentCaseInput[];
  timerDurationSeconds: number;
  /** Default PSEINT si se omite — mantiene compatible a los call sites existentes (torneos que no usan ejecución automática). */
  language?: TournamentLanguage;
}

/** Cuántos casos hacen falta: uno por ronda, incluyendo la clasificatoria si aplica. */
export function expectedCaseCount(teamCount: number): number {
  const qualifyingNeeded = !PowerOfTwoMath.isPowerOfTwo(teamCount);
  const bracketSize = qualifyingNeeded ? PowerOfTwoMath.largestPowerOfTwoLessOrEqual(teamCount) : teamCount;
  const bracketRounds = Math.log2(bracketSize);
  return (qualifyingNeeded ? 1 : 0) + bracketRounds;
}

export type StartTournamentOutput =
  | { kind: 'QUALIFYING_ROUND_STARTED'; qualifyingRoundId: string; targetQualifierCount: number }
  | { kind: 'BRACKET_STARTED'; roundId: string; matchCount: number };

/**
 * StartTournamentUseCase: orquesta el arranque del torneo.
 *
 * Decisión (responsabilidad del orquestador, no del dominio): si el número
 * de equipos ya es potencia de 2, genera directamente la ronda de Cuartos.
 * Si no, primero crea la QualifyingRound — el bracket principal se genera
 * después, cuando el profesor cierre esa ronda (ver
 * FinalizeQualifyingRoundUseCase).
 */
export class StartTournamentUseCase {
  constructor(
    private readonly tournamentRepository: TournamentRepository,
    private readonly teamRepository: TeamRepository,
    private readonly businessCaseRepository: BusinessCaseRepository,
    private readonly qualifyingRoundRepository: QualifyingRoundRepository,
  ) {}

  async execute(input: StartTournamentInput): Promise<StartTournamentOutput> {
    const tournament = await this.tournamentRepository.findById(
      EntityId.fromString(input.tournamentId),
    );
    if (!tournament) {
      throw new Error(`Torneo ${input.tournamentId} no encontrado`);
    }
    if (tournament.getStatus() !== TournamentStatus.DRAFT) {
      throw new Error('El torneo ya fue iniciado');
    }

    const teamIds = input.teamIds.map((id) => EntityId.fromString(id));
    const teams = await this.teamRepository.findByIds(teamIds);
    if (teams.length !== teamIds.length) {
      throw new Error('Alguno de los equipos indicados no existe');
    }

    const requiredCases = expectedCaseCount(teams.length);
    if (input.cases.length !== requiredCases) {
      throw new Error(
        `Se esperaban ${requiredCases} casos (uno por ronda, incluyendo la clasificatoria si aplica), se recibieron ${input.cases.length}`,
      );
    }

    const language = input.language ?? TournamentLanguage.PSEINT;
    if (language === TournamentLanguage.PYTHON) {
      const caseWithoutEnoughTestCases = input.cases.find(
        (c) => (c.testCases?.length ?? 0) < MIN_TEST_CASES_FOR_PYTHON,
      );
      if (caseWithoutEnoughTestCases) {
        throw new Error(
          `Cada caso de un torneo Python necesita al menos ${MIN_TEST_CASES_FOR_PYTHON} casos de prueba`,
        );
      }
    }

    const businessCases: BusinessCase[] = [];
    for (const caseInput of input.cases) {
      const businessCase = new BusinessCase(
        EntityId.generate(),
        caseInput.title,
        caseInput.description,
        RequiredStructureType.SINGLE_STRUCTURE,
        caseInput.testCases ?? [],
      );
      await this.businessCaseRepository.save(businessCase);
      businessCases.push(businessCase);
    }
    const pendingCaseIds = businessCases.slice(1).map((c) => c.getId());

    if (!PowerOfTwoMath.isPowerOfTwo(teams.length)) {
      const qualifyingRound = new QualifyingRound(
        EntityId.generate(),
        teams,
        businessCases[0],
        input.timerDurationSeconds,
      );
      await this.qualifyingRoundRepository.save(qualifyingRound, tournament.getId());
      tournament.enterQualifying();
      tournament.setPendingCaseIds(pendingCaseIds);
      tournament.setLanguage(language);
      await this.tournamentRepository.save(tournament);

      return {
        kind: 'QUALIFYING_ROUND_STARTED',
        qualifyingRoundId: qualifyingRound.getId().toString(),
        targetQualifierCount: qualifyingRound.getTargetQualifierCount(),
      };
    }

    const round = BracketGenerationService.generateInitialRound(
      teams,
      EntityId.generate(),
      'Cuartos de Final',
      businessCases[0],
      input.timerDurationSeconds,
    );
    tournament.addRound(round);
    tournament.start();
    tournament.setPendingCaseIds(pendingCaseIds);
    tournament.setLanguage(language);
    await this.tournamentRepository.save(tournament);

    return {
      kind: 'BRACKET_STARTED',
      roundId: round.getId().toString(),
      matchCount: round.getMatches().length,
    };
  }
}
