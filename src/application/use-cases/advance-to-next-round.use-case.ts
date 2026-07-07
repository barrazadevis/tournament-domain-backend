import { EntityId } from '../../domain/value-objects/entity-id';
import { Match } from '../../domain/entities/match';
import { Round } from '../../domain/entities/round';
import { BracketAdvancementService } from '../../domain/services/bracket-advancement.service';
import { TournamentRepository } from '../ports/tournament.repository';
import { BusinessCaseRepository } from '../ports/business-case.repository';

export interface AdvanceToNextRoundInput {
  tournamentId: string;
  currentRoundOrder: number;
  nextRoundName: string;
  timerDurationSeconds: number;
}

export type AdvanceToNextRoundOutput =
  | { kind: 'NEXT_ROUND_CREATED'; roundId: string; matchCount: number }
  | { kind: 'TOURNAMENT_FINISHED'; championTeamId: string };

/**
 * AdvanceToNextRoundUseCase: cierra una ronda ya completa y decide qué sigue.
 *
 * Si la ronda que termina tenía un solo match, esa ronda ERA la final —
 * el torneo se cierra y se declara campeón (no se genera una ronda "de 0
 * matches"). En cualquier otro caso, delega en BracketAdvancementService
 * el emparejamiento aleatorio de los ganadores para armar la siguiente ronda.
 */
export class AdvanceToNextRoundUseCase {
  constructor(
    private readonly tournamentRepository: TournamentRepository,
    private readonly businessCaseRepository: BusinessCaseRepository,
  ) {}

  async execute(input: AdvanceToNextRoundInput): Promise<AdvanceToNextRoundOutput> {
    const tournament = await this.tournamentRepository.findById(
      EntityId.fromString(input.tournamentId),
    );
    if (!tournament) {
      throw new Error(`Torneo ${input.tournamentId} no encontrado`);
    }

    const currentRound = tournament.getRoundByOrder(input.currentRoundOrder);
    if (!currentRound) {
      throw new Error(`Ronda con order=${input.currentRoundOrder} no encontrada`);
    }

    if (BracketAdvancementService.isTournamentComplete(currentRound)) {
      const championId = BracketAdvancementService.getTournamentChampion(currentRound);
      tournament.finish();
      await this.tournamentRepository.save(tournament);
      return { kind: 'TOURNAMENT_FINISHED', championTeamId: championId.toString() };
    }

    const pairings = BracketAdvancementService.computeNextRoundPairings(currentRound);
    const nextCaseId = tournament.consumeNextCaseId();
    const businessCase = await this.businessCaseRepository.findById(nextCaseId);
    if (!businessCase) {
      throw new Error(`Caso planificado para la ronda "${input.nextRoundName}" no encontrado`);
    }

    const nextRound = new Round(
      EntityId.generate(),
      input.nextRoundName,
      currentRound.getOrder() + 1,
    );

    for (const pairing of pairings) {
      nextRound.addMatch(
        new Match(
          EntityId.generate(),
          input.nextRoundName,
          pairing.teamAId,
          pairing.teamBId,
          businessCase,
          input.timerDurationSeconds,
        ),
      );
    }

    tournament.addRound(nextRound);
    await this.tournamentRepository.save(tournament);

    return {
      kind: 'NEXT_ROUND_CREATED',
      roundId: nextRound.getId().toString(),
      matchCount: nextRound.getMatches().length,
    };
  }
}
