import { EntityId } from '../src/domain/value-objects/entity-id';
import { Match } from '../src/domain/entities/match';
import { Round } from '../src/domain/entities/round';
import { Submission } from '../src/domain/entities/submission';
import { BusinessCase, RequiredStructureType } from '../src/domain/entities/business-case';
import {
  BracketAdvancementService,
  RoundNotCompleteError,
  ManualResolutionRequiredError,
} from '../src/domain/services/bracket-advancement.service';
import { ShuffleFn } from '../src/domain/services/bracket-generation.service';

function buildResolvedMatch(winnerId: EntityId, loserId: EntityId): Match {
  const businessCase = new BusinessCase(
    EntityId.generate(),
    'Caso',
    'Descripción del caso',
    RequiredStructureType.SINGLE_STRUCTURE,
  );
  const match = new Match(EntityId.generate(), 'Cuartos', winnerId, loserId, businessCase, 300);
  const now = new Date();
  match.start(now);
  match.submitSolution(new Submission(EntityId.generate(), winnerId, 'Solución ganadora', now));
  match.approveCurrentSubmission(winnerId, now);
  return match;
}

function buildNoWinnerMatch(): Match {
  const teamA = EntityId.generate();
  const teamB = EntityId.generate();
  const businessCase = new BusinessCase(
    EntityId.generate(),
    'Caso',
    'Descripción',
    RequiredStructureType.SINGLE_STRUCTURE,
  );
  const match = new Match(EntityId.generate(), 'Cuartos', teamA, teamB, businessCase, 300);
  const now = new Date();
  match.start(now);
  match.submitSolution(new Submission(EntityId.generate(), teamA, 'Intento fallido A', now));
  match.rejectCurrentSubmission(teamA, now);
  match.submitSolution(new Submission(EntityId.generate(), teamB, 'Intento fallido B', now));
  match.rejectCurrentSubmission(teamB, now);
  return match;
}

const identityShuffle: ShuffleFn = <T>(items: T[]): T[] => [...items];
/** Shuffle que invierte el orden - útil para probar que el resultado cambia con el shuffle inyectado. */
const reverseShuffle: ShuffleFn = <T>(items: T[]): T[] => [...items].reverse();

describe('BracketAdvancementService', () => {
  it('empareja ganadores adyacentes cuando se usa identityShuffle (determinístico)', () => {
    const round = new Round(EntityId.generate(), 'Cuartos de Final', 0);

    const winner1 = EntityId.generate();
    const winner2 = EntityId.generate();
    const winner3 = EntityId.generate();
    const winner4 = EntityId.generate();

    round.addMatch(buildResolvedMatch(winner1, EntityId.generate()));
    round.addMatch(buildResolvedMatch(winner2, EntityId.generate()));
    round.addMatch(buildResolvedMatch(winner3, EntityId.generate()));
    round.addMatch(buildResolvedMatch(winner4, EntityId.generate()));

    const pairings = BracketAdvancementService.computeNextRoundPairings(round, identityShuffle);

    expect(pairings).toHaveLength(2);
    expect(pairings[0].teamAId.equals(winner1)).toBe(true);
    expect(pairings[0].teamBId.equals(winner2)).toBe(true);
    expect(pairings[1].teamAId.equals(winner3)).toBe(true);
    expect(pairings[1].teamBId.equals(winner4)).toBe(true);
  });

  it('el emparejamiento cambia según el shuffle inyectado (confirma que no hay posición fija)', () => {
    const round = new Round(EntityId.generate(), 'Cuartos de Final', 0);
    const winner1 = EntityId.generate();
    const winner2 = EntityId.generate();
    const winner3 = EntityId.generate();
    const winner4 = EntityId.generate();

    round.addMatch(buildResolvedMatch(winner1, EntityId.generate()));
    round.addMatch(buildResolvedMatch(winner2, EntityId.generate()));
    round.addMatch(buildResolvedMatch(winner3, EntityId.generate()));
    round.addMatch(buildResolvedMatch(winner4, EntityId.generate()));

    const withIdentity = BracketAdvancementService.computeNextRoundPairings(round, identityShuffle);
    const withReverse = BracketAdvancementService.computeNextRoundPairings(round, reverseShuffle);

    // Con identity: winner1 vs winner2. Con reverse: winner4 vs winner3.
    expect(withIdentity[0].teamAId.equals(winner1)).toBe(true);
    expect(withReverse[0].teamAId.equals(winner4)).toBe(true);
  });

  it('lanza RoundNotCompleteError si algún match de la ronda sigue sin resolver', () => {
    const round = new Round(EntityId.generate(), 'Cuartos de Final', 0);
    round.addMatch(buildResolvedMatch(EntityId.generate(), EntityId.generate()));

    const businessCase = new BusinessCase(
      EntityId.generate(),
      'Caso',
      'Descripción',
      RequiredStructureType.SINGLE_STRUCTURE,
    );
    const unresolvedMatch = new Match(
      EntityId.generate(),
      'Cuartos',
      EntityId.generate(),
      EntityId.generate(),
      businessCase,
      300,
    );
    round.addMatch(unresolvedMatch);

    expect(() => BracketAdvancementService.computeNextRoundPairings(round)).toThrow(
      RoundNotCompleteError,
    );
  });

  it('lanza ManualResolutionRequiredError si un match terminó en NO_WINNER', () => {
    const round = new Round(EntityId.generate(), 'Cuartos de Final', 0);
    round.addMatch(buildNoWinnerMatch());
    round.addMatch(buildResolvedMatch(EntityId.generate(), EntityId.generate()));

    expect(() => BracketAdvancementService.computeNextRoundPairings(round)).toThrow(
      ManualResolutionRequiredError,
    );
  });

  it('detecta correctamente cuándo el torneo terminó', () => {
    const finalRound = new Round(EntityId.generate(), 'Gran Final', 2);
    const champion = EntityId.generate();
    finalRound.addMatch(buildResolvedMatch(champion, EntityId.generate()));

    expect(BracketAdvancementService.isTournamentComplete(finalRound)).toBe(true);
    expect(BracketAdvancementService.getTournamentChampion(finalRound).equals(champion)).toBe(
      true,
    );
  });

  it('isTournamentComplete es false si la final aún no se resuelve', () => {
    const businessCase = new BusinessCase(
      EntityId.generate(),
      'Caso',
      'Descripción',
      RequiredStructureType.SINGLE_STRUCTURE,
    );
    const finalRound = new Round(EntityId.generate(), 'Gran Final', 2);
    finalRound.addMatch(
      new Match(
        EntityId.generate(),
        'Final',
        EntityId.generate(),
        EntityId.generate(),
        businessCase,
        300,
      ),
    );

    expect(BracketAdvancementService.isTournamentComplete(finalRound)).toBe(false);
  });
});
