import { EntityId } from '../value-objects/entity-id';
import { Round } from '../entities/round';
import { ShuffleFn, defaultShuffle } from './bracket-generation.service';

export class RoundNotCompleteError extends Error {
  constructor() {
    super('No se puede avanzar: hay matches sin resolver en la ronda actual');
    this.name = 'RoundNotCompleteError';
  }
}

export class ManualResolutionRequiredError extends Error {
  constructor(matchId: string) {
    super(
      `El match ${matchId} terminó sin ganador (NO_WINNER). ` +
        'El profesor debe decidir manualmente cómo avanzar antes de continuar.',
    );
    this.name = 'ManualResolutionRequiredError';
  }
}

export interface NextRoundPairing {
  teamAId: EntityId;
  teamBId: EntityId;
}

/**
 * BracketAdvancementService: calcula los emparejamientos de la siguiente
 * ronda a partir de los GANADORES de la ronda actual ya resuelta.
 *
 * Decisión clave (corregida a partir de la conversación con el usuario):
 * el emparejamiento de cada ronda se genera mezclando aleatoriamente a los
 * ganadores en el momento de avanzar — NO se hereda ninguna posición fija
 * de un "árbol" de bracket definido de antemano. Esto significa que el
 * ganador del match 1 puede terminar enfrentando al ganador del match 4
 * en la siguiente ronda, con la misma probabilidad que a cualquier otro.
 *
 * Como el número de equipos que llega aquí siempre es potencia de 2
 * (gracias a QualifyingRound + BracketGenerationService), el número de
 * ganadores en cada ronda también lo es, así que el emparejamiento nunca
 * deja a nadie sin rival.
 */
export class BracketAdvancementService {
  static computeNextRoundPairings(
    round: Round,
    shuffle: ShuffleFn = defaultShuffle,
  ): NextRoundPairing[] {
    if (!round.isComplete()) {
      throw new RoundNotCompleteError();
    }

    const matches = round.getMatches();
    for (const match of matches) {
      if (match.getResolution() === 'NO_WINNER') {
        throw new ManualResolutionRequiredError(match.getId().toString());
      }
    }

    const winnerIds = matches.map((m) => m.getWinnerId() as EntityId);
    const shuffledWinners = shuffle(winnerIds);

    const pairings: NextRoundPairing[] = [];
    for (let i = 0; i < shuffledWinners.length; i += 2) {
      pairings.push({
        teamAId: shuffledWinners[i],
        teamBId: shuffledWinners[i + 1],
      });
    }
    return pairings;
  }

  static isTournamentComplete(finalRound: Round): boolean {
    const matches = finalRound.getMatches();
    return matches.length === 1 && matches[0].getResolution() === 'WINNER';
  }

  static getTournamentChampion(finalRound: Round): EntityId {
    if (!this.isTournamentComplete(finalRound)) {
      throw new Error('El torneo aún no ha terminado');
    }
    return finalRound.getMatches()[0].getWinnerId() as EntityId;
  }
}
