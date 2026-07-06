import { EntityId } from '../value-objects/entity-id';
import { Team } from '../entities/team';
import { Match } from '../entities/match';
import { Round } from '../entities/round';
import { BusinessCase } from '../entities/business-case';
import { PowerOfTwoMath } from './power-of-two-math';

export type ShuffleFn = <T>(items: T[]) => T[];

export const defaultShuffle: ShuffleFn = <T>(items: T[]): T[] => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

export class NotPowerOfTwoError extends Error {
  constructor(count: number) {
    super(
      `Se requieren ${count} equipos pero no es potencia de 2. ` +
        'Ejecuta una QualifyingRound primero para reducir el número.',
    );
    this.name = 'NotPowerOfTwoError';
  }
}

/**
 * BracketGenerationService: genera la ronda inicial del bracket principal.
 *
 * Precondición estricta: el número de equipos debe ser potencia de 2. Si
 * no lo es, este servicio se niega a generar nada — la responsabilidad de
 * reducir el número (vía QualifyingRound) es de una capa anterior, no de
 * este servicio (Single Responsibility).
 */
export class BracketGenerationService {
  static generateInitialRound(
    teams: Team[],
    roundId: EntityId,
    roundName: string,
    businessCase: BusinessCase,
    timerDurationSeconds: number,
    shuffle: ShuffleFn = defaultShuffle,
  ): Round {
    if (teams.length < 2) {
      throw new Error('Se necesitan al menos 2 equipos para generar un bracket');
    }
    if (!PowerOfTwoMath.isPowerOfTwo(teams.length)) {
      throw new NotPowerOfTwoError(teams.length);
    }

    const round = new Round(roundId, roundName, 0);
    const shuffledTeams = shuffle(teams);

    for (let i = 0; i < shuffledTeams.length; i += 2) {
      round.addMatch(
        new Match(
          EntityId.generate(),
          roundName,
          shuffledTeams[i].getId(),
          shuffledTeams[i + 1].getId(),
          businessCase,
          timerDurationSeconds,
        ),
      );
    }

    return round;
  }
}
