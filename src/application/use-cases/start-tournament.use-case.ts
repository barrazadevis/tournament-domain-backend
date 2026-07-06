import { EntityId } from '../../domain/value-objects/entity-id';
import { BusinessCase, RequiredStructureType } from '../../domain/entities/business-case';
import { QualifyingRound } from '../../domain/entities/qualifying-round';
import { PowerOfTwoMath } from '../../domain/services/power-of-two-math';
import { BracketGenerationService } from '../../domain/services/bracket-generation.service';
import { TournamentRepository } from '../ports/tournament.repository';
import { TeamRepository } from '../ports/team.repository';
import { BusinessCaseRepository } from '../ports/business-case.repository';
import { QualifyingRoundRepository } from '../ports/qualifying-round.repository';

export interface StartTournamentInput {
  tournamentId: string;
  teamIds: string[];
  caseTitle: string;
  caseDescription: string;
  timerDurationSeconds: number;
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

    const teamIds = input.teamIds.map((id) => EntityId.fromString(id));
    const teams = await this.teamRepository.findByIds(teamIds);
    if (teams.length !== teamIds.length) {
      throw new Error('Alguno de los equipos indicados no existe');
    }

    const businessCase = new BusinessCase(
      EntityId.generate(),
      input.caseTitle,
      input.caseDescription,
      RequiredStructureType.SINGLE_STRUCTURE,
    );
    await this.businessCaseRepository.save(businessCase);

    if (!PowerOfTwoMath.isPowerOfTwo(teams.length)) {
      const qualifyingRound = new QualifyingRound(
        EntityId.generate(),
        teams,
        businessCase,
        input.timerDurationSeconds,
      );
      await this.qualifyingRoundRepository.save(qualifyingRound, tournament.getId());

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
      businessCase,
      input.timerDurationSeconds,
    );
    tournament.addRound(round);
    tournament.start();
    await this.tournamentRepository.save(tournament);

    return {
      kind: 'BRACKET_STARTED',
      roundId: round.getId().toString(),
      matchCount: round.getMatches().length,
    };
  }
}
