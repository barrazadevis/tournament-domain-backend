import { EntityId } from '../../domain/value-objects/entity-id';
import { BracketGenerationService } from '../../domain/services/bracket-generation.service';
import { TournamentRepository } from '../ports/tournament.repository';
import { TeamRepository } from '../ports/team.repository';
import { QualifyingRoundRepository } from '../ports/qualifying-round.repository';
import { BusinessCaseRepository } from '../ports/business-case.repository';

export interface FinalizeQualifyingRoundInput {
  tournamentId: string;
}

export interface FinalizeQualifyingRoundOutput {
  roundId: string;
  qualifiedTeamNames: string[];
}

/**
 * FinalizeQualifyingRoundUseCase: cierra la clasificatoria (todas las
 * submissions ya deben estar juzgadas — QualifyingRound.computeQualifiers()
 * lanza si no) y genera la ronda de Cuartos con los equipos que avanzaron.
 */
export class FinalizeQualifyingRoundUseCase {
  constructor(
    private readonly tournamentRepository: TournamentRepository,
    private readonly teamRepository: TeamRepository,
    private readonly qualifyingRoundRepository: QualifyingRoundRepository,
    private readonly businessCaseRepository: BusinessCaseRepository,
  ) {}

  async execute(input: FinalizeQualifyingRoundInput): Promise<FinalizeQualifyingRoundOutput> {
    const tournamentId = EntityId.fromString(input.tournamentId);

    const tournament = await this.tournamentRepository.findById(tournamentId);
    if (!tournament) {
      throw new Error(`Torneo ${input.tournamentId} no encontrado`);
    }

    const qualifyingRound = await this.qualifyingRoundRepository.findByTournamentId(tournamentId);
    if (!qualifyingRound) {
      throw new Error('Este torneo no tiene ronda clasificatoria activa');
    }

    const qualifiedTeamIds = qualifyingRound.computeQualifiers();
    const qualifiedTeams = await this.teamRepository.findByIds(qualifiedTeamIds);

    const nextCaseId = tournament.consumeNextCaseId();
    const businessCase = await this.businessCaseRepository.findById(nextCaseId);
    if (!businessCase) {
      throw new Error('El caso planificado para Cuartos de Final no se encontró');
    }

    const round = BracketGenerationService.generateInitialRound(
      qualifiedTeams,
      EntityId.generate(),
      'Cuartos de Final',
      businessCase,
      qualifyingRound.getTimerDurationSeconds(),
    );

    tournament.addRound(round);
    tournament.start();
    await this.tournamentRepository.save(tournament);

    return {
      roundId: round.getId().toString(),
      qualifiedTeamNames: qualifiedTeams.map((t) => t.getName()),
    };
  }
}
