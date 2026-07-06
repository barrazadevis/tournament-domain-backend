import { EntityId } from '../src/domain/value-objects/entity-id';
import { Team } from '../src/domain/entities/team';
import { BusinessCase, RequiredStructureType } from '../src/domain/entities/business-case';
import {
  BracketGenerationService,
  NotPowerOfTwoError,
  ShuffleFn,
} from '../src/domain/services/bracket-generation.service';

function buildTeams(count: number): Team[] {
  return Array.from({ length: count }, (_, i) =>
    new Team(EntityId.generate(), `Equipo ${i + 1}`, [{ fullName: `Estudiante ${i + 1}` }]),
  );
}

function buildCase(): BusinessCase {
  return new BusinessCase(
    EntityId.generate(),
    'Cálculo de bono',
    'Diseñar el ciclo para calcular el bono de 20 vendedores',
    RequiredStructureType.SINGLE_STRUCTURE,
  );
}

const identityShuffle: ShuffleFn = <T>(items: T[]): T[] => [...items];

describe('BracketGenerationService', () => {
  it('rechaza menos de 2 equipos', () => {
    expect(() =>
      BracketGenerationService.generateInitialRound(
        buildTeams(1),
        EntityId.generate(),
        'Cuartos',
        buildCase(),
        300,
        identityShuffle,
      ),
    ).toThrow();
  });

  it('rechaza un número de equipos que no es potencia de 2', () => {
    expect(() =>
      BracketGenerationService.generateInitialRound(
        buildTeams(9),
        EntityId.generate(),
        'Cuartos',
        buildCase(),
        300,
        identityShuffle,
      ),
    ).toThrow(NotPowerOfTwoError);
  });

  it('con 8 equipos genera 4 matches sin ningún equipo sin rival', () => {
    const teams = buildTeams(8);
    const round = BracketGenerationService.generateInitialRound(
      teams,
      EntityId.generate(),
      'Cuartos',
      buildCase(),
      300,
      identityShuffle,
    );

    expect(round.getMatches()).toHaveLength(4);
    const teamIdsInMatches = round
      .getMatches()
      .flatMap((m) => [m.includesTeam(teams[0].getId())]);
    // Cada equipo original debe estar en exactamente un match (todos compiten).
    const allTeamIds = teams.map((t) => t.getId());
    const coveredCount = allTeamIds.filter((id) =>
      round.getMatches().some((m) => m.includesTeam(id)),
    ).length;
    expect(coveredCount).toBe(8);
  });

  it('con 4 equipos genera 2 matches', () => {
    const round = BracketGenerationService.generateInitialRound(
      buildTeams(4),
      EntityId.generate(),
      'Semifinal',
      buildCase(),
      300,
      identityShuffle,
    );
    expect(round.getMatches()).toHaveLength(2);
  });
});
