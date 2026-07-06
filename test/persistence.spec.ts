import { unlinkSync, existsSync } from 'node:fs';
import { EntityId } from '../src/domain/value-objects/entity-id';
import { Team } from '../src/domain/entities/team';
import { BusinessCase, RequiredStructureType } from '../src/domain/entities/business-case';
import { Submission } from '../src/domain/entities/submission';
import { Tournament } from '../src/domain/entities/tournament';
import { Round } from '../src/domain/entities/round';
import { Match } from '../src/domain/entities/match';
import { QualifyingRound } from '../src/domain/entities/qualifying-round';
import { TournamentDatabase } from '../src/infrastructure/persistence/sqlite/database';
import { SqliteTeamRepository } from '../src/infrastructure/persistence/sqlite/team.repository';
import { SqliteTournamentRepository } from '../src/infrastructure/persistence/sqlite/tournament.repository';
import { SqliteQualifyingRoundRepository } from '../src/infrastructure/persistence/sqlite/qualifying-round.repository';

const TEST_DB_PATH = `${__dirname}/test-tournament.db`;

function buildCase(): BusinessCase {
  return new BusinessCase(
    EntityId.generate(),
    'Cálculo de bono',
    'Diseñar el ciclo para calcular el bono de 20 vendedores',
    RequiredStructureType.SINGLE_STRUCTURE,
  );
}

describe('Persistencia SQLite (integración)', () => {
  let db: TournamentDatabase;
  let teamRepository: SqliteTeamRepository;
  let tournamentRepository: SqliteTournamentRepository;
  let qualifyingRoundRepository: SqliteQualifyingRoundRepository;

  beforeEach(() => {
    if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH);
    db = new TournamentDatabase(TEST_DB_PATH);
    teamRepository = new SqliteTeamRepository(db);
    tournamentRepository = new SqliteTournamentRepository(db);
    qualifyingRoundRepository = new SqliteQualifyingRoundRepository(db, teamRepository);
  });

  afterEach(() => {
    db.close();
    if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH);
  });

  it('guarda y recupera un Team tal cual', async () => {
    const team = new Team(EntityId.generate(), 'Los Refactorizadores', [
      { fullName: 'Ana Pérez' },
      { fullName: 'Luis Gómez' },
    ]);

    await teamRepository.save(team);
    const loaded = await teamRepository.findById(team.getId());

    expect(loaded).not.toBeNull();
    expect(loaded!.getName()).toBe('Los Refactorizadores');
    expect(loaded!.getMembers()).toHaveLength(2);
    expect(loaded!.isEliminated()).toBe(false);
  });

  it('persiste el estado de eliminación de un Team', async () => {
    const team = new Team(EntityId.generate(), 'Equipo X', [{ fullName: 'Juan' }]);
    team.eliminate();

    await teamRepository.save(team);
    const loaded = await teamRepository.findById(team.getId());

    expect(loaded!.isEliminated()).toBe(true);
  });

  it('guarda y recupera un Tournament completo con una ronda y un match resuelto', async () => {
    const teamA = new Team(EntityId.generate(), 'Equipo A', [{ fullName: 'Ana' }]);
    const teamB = new Team(EntityId.generate(), 'Equipo B', [{ fullName: 'Beto' }]);
    await teamRepository.save(teamA);
    await teamRepository.save(teamB);

    const businessCase = buildCase();
    const now = new Date('2026-01-01T10:00:00Z');

    const match = new Match(
      EntityId.generate(),
      'Cuartos de Final',
      teamA.getId(),
      teamB.getId(),
      businessCase,
      300,
    );
    match.start(now);
    match.submitSolution(
      new Submission(EntityId.generate(), teamA.getId(), 'Estructura Para', now),
    );
    match.approveCurrentSubmission(now);

    const round = new Round(EntityId.generate(), 'Cuartos de Final', 0);
    round.addMatch(match);

    const tournament = new Tournament(EntityId.generate(), 'Torneo Eliminatorio de Casos');
    tournament.addRound(round);
    tournament.start();

    await tournamentRepository.save(tournament);
    const loaded = await tournamentRepository.findById(tournament.getId());

    expect(loaded).not.toBeNull();
    expect(loaded!.getName()).toBe('Torneo Eliminatorio de Casos');
    expect(loaded!.getRounds()).toHaveLength(1);

    const loadedMatch = loaded!.getRounds()[0].getMatches()[0];
    expect(loadedMatch.getStatus()).toBe('RESOLVED');
    expect(loadedMatch.getWinnerId()?.equals(teamA.getId())).toBe(true);
    expect(loadedMatch.getSubmissions()).toHaveLength(1);
    expect(loadedMatch.getBusinessCase().getTitle()).toBe('Cálculo de bono');
  });

  it('persiste correctamente un match con rechazo (descalificación incluida)', async () => {
    const teamA = new Team(EntityId.generate(), 'Equipo A', [{ fullName: 'Ana' }]);
    const teamB = new Team(EntityId.generate(), 'Equipo B', [{ fullName: 'Beto' }]);
    await teamRepository.save(teamA);
    await teamRepository.save(teamB);

    const now = new Date();
    const match = new Match(
      EntityId.generate(),
      'Cuartos',
      teamA.getId(),
      teamB.getId(),
      buildCase(),
      300,
    );
    match.start(now);
    match.submitSolution(new Submission(EntityId.generate(), teamA.getId(), 'Intento fallido', now));
    match.rejectCurrentSubmission(now);

    const round = new Round(EntityId.generate(), 'Cuartos', 0);
    round.addMatch(match);
    const tournament = new Tournament(EntityId.generate(), 'Torneo Test');
    tournament.addRound(round);

    await tournamentRepository.save(tournament);
    const loaded = await tournamentRepository.findById(tournament.getId());
    const loadedMatch = loaded!.getRounds()[0].getMatches()[0];

    expect(loadedMatch.getStatus()).toBe('ACTIVE'); // volvió a ACTIVE tras el rechazo
    expect(loadedMatch.getDisqualifiedTeamIds()).toContain(teamA.getId().toString());

    // Confirmamos que el equipo A sigue sin poder reintentar tras recargar de BD.
    expect(() =>
      loadedMatch.submitSolution(
        new Submission(EntityId.generate(), teamA.getId(), 'Segundo intento', now),
      ),
    ).toThrow('descalificado');
  });

  it('guarda y recupera una QualifyingRound completa', async () => {
    const teams = Array.from({ length: 9 }, (_, i) =>
      new Team(EntityId.generate(), `Equipo ${i + 1}`, [{ fullName: `Estudiante ${i + 1}` }]),
    );
    for (const team of teams) await teamRepository.save(team);

    const qualifyingRound = new QualifyingRound(EntityId.generate(), teams, buildCase(), 300);
    const now = new Date();
    teams.forEach((team, index) => {
      const submittedAt = new Date(now.getTime() + index * 1000);
      qualifyingRound.submit(
        new Submission(EntityId.generate(), team.getId(), `Intento ${index}`, submittedAt),
      );
    });
    teams.forEach((team) => qualifyingRound.approveSubmission(team.getId(), now));

    const tournament = new Tournament(EntityId.generate(), 'Torneo con clasificatoria');
    await tournamentRepository.save(tournament);
    await qualifyingRoundRepository.save(qualifyingRound, tournament.getId());

    const loaded = await qualifyingRoundRepository.findByTournamentId(tournament.getId());

    expect(loaded).not.toBeNull();
    expect(loaded!.getTargetQualifierCount()).toBe(8);
    const qualifiers = loaded!.computeQualifiers();
    expect(qualifiers).toHaveLength(8);
    expect(qualifiers.some((id) => id.equals(teams[8].getId()))).toBe(false);
  });

  it('devuelve null si el torneo no existe', async () => {
    const loaded = await tournamentRepository.findById(EntityId.generate());
    expect(loaded).toBeNull();
  });
});
