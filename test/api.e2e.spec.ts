import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/infrastructure/http/app.module';
import {
  TEAM_REPOSITORY,
  TOURNAMENT_REPOSITORY,
  BUSINESS_CASE_REPOSITORY,
  QUALIFYING_ROUND_REPOSITORY,
  TOURNAMENT_DATABASE,
  USER_REPOSITORY,
  SESSION_REPOSITORY,
  PASSWORD_HASHER,
} from '../src/infrastructure/http/tokens';
import {
  InMemoryTeamRepository,
  InMemoryTournamentRepository,
  InMemoryBusinessCaseRepository,
  InMemoryQualifyingRoundRepository,
  InMemoryUserRepository,
  InMemorySessionRepository,
  FakePasswordHasher,
} from './fakes/in-memory-repositories';

describe('Tournament API (E2E)', () => {
  let app: INestApplication;
  let profesorToken: string;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(TOURNAMENT_DATABASE)
      .useValue({}) // nunca se usa: todos sus consumidores están sobreescritos abajo
      .overrideProvider(TEAM_REPOSITORY)
      .useValue(new InMemoryTeamRepository())
      .overrideProvider(TOURNAMENT_REPOSITORY)
      .useValue(new InMemoryTournamentRepository())
      .overrideProvider(BUSINESS_CASE_REPOSITORY)
      .useValue(new InMemoryBusinessCaseRepository())
      .overrideProvider(QUALIFYING_ROUND_REPOSITORY)
      .useValue(new InMemoryQualifyingRoundRepository())
      .overrideProvider(USER_REPOSITORY)
      .useValue(new InMemoryUserRepository())
      .overrideProvider(SESSION_REPOSITORY)
      .useValue(new InMemorySessionRepository())
      .overrideProvider(PASSWORD_HASHER)
      .useValue(new FakePasswordHasher())
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    const bootstrapRes = await request(app.getHttpServer())
      .post('/auth/bootstrap')
      .send({ email: 'profesor@colegio.edu', password: 'claveSegura1' });
    profesorToken = bootstrapRes.body.token;
  });

  afterEach(async () => {
    await app.close();
  });

  it('rechaza el registro de un equipo sin integrantes (validación del DTO)', async () => {
    const response = await request(app.getHttpServer())
      .post('/teams')
      .send({ name: 'Equipo Vacío', memberNames: [] });

    expect(response.status).toBe(400);
  });

  it('flujo completo: registrar equipos, crear torneo, iniciar bracket directo (8 equipos)', async () => {
    const teamIds: string[] = [];
    for (let i = 0; i < 8; i++) {
      const res = await request(app.getHttpServer())
        .post('/teams')
        .send({ name: `Equipo ${i + 1}`, memberNames: [`Estudiante ${i + 1}`] });
      expect(res.status).toBe(201);
      teamIds.push(res.body.id);
    }

    const tournamentRes = await request(app.getHttpServer())
      .post('/tournaments')
      .set('Authorization', `Bearer ${profesorToken}`)
      .send({ name: 'Torneo E2E' });
    expect(tournamentRes.status).toBe(201);
    const tournamentId = tournamentRes.body.id;

    const startRes = await request(app.getHttpServer())
      .post(`/tournaments/${tournamentId}/start`)
      .set('Authorization', `Bearer ${profesorToken}`)
      .send({
        teamIds,
        cases: [
          { title: 'Cuartos', description: 'Caso de cuartos' },
          { title: 'Semifinal', description: 'Caso de semifinal' },
          { title: 'Final', description: 'Caso de la final' },
        ],
        timerDurationSeconds: 300,
      });
    expect(startRes.status).toBe(201);
    expect(startRes.body.kind).toBe('BRACKET_STARTED');

    const getRes = await request(app.getHttpServer()).get(`/tournaments/${tournamentId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.rounds).toHaveLength(1);
    expect(getRes.body.rounds[0].matches).toHaveLength(4);

    const firstMatch = getRes.body.rounds[0].matches[0];

    await request(app.getHttpServer())
      .post(`/matches/${firstMatch.id}/start`)
      .set('Authorization', `Bearer ${profesorToken}`)
      .send({})
      .expect(201);

    await request(app.getHttpServer())
      .post(`/matches/${firstMatch.id}/submissions`)
      .send({ teamId: firstMatch.teamAId, content: 'Estructura Para' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/matches/${firstMatch.id}/verdict`)
      .set('Authorization', `Bearer ${profesorToken}`)
      .send({ teamId: firstMatch.teamAId, approve: true })
      .expect(201);

    const afterVerdict = await request(app.getHttpServer()).get(`/tournaments/${tournamentId}`);
    const updatedMatch = afterVerdict.body.rounds[0].matches.find(
      (m: { id: string }) => m.id === firstMatch.id,
    );
    expect(updatedMatch.status).toBe('RESOLVED');
    expect(updatedMatch.winnerId).toBe(firstMatch.teamAId);
  });

  it('devuelve 409 (no 500) al iniciar dos veces un torneo con clasificatoria (bug reportado por el usuario)', async () => {
    const teamIds: string[] = [];
    for (let i = 0; i < 5; i++) {
      const res = await request(app.getHttpServer())
        .post('/teams')
        .send({ name: `Equipo Clasificatoria ${i + 1}`, memberNames: [`Estudiante ${i + 1}`] });
      teamIds.push(res.body.id);
    }

    const tournamentRes = await request(app.getHttpServer())
      .post('/tournaments')
      .set('Authorization', `Bearer ${profesorToken}`)
      .send({ name: 'Torneo E2E Clasificatoria' });
    const tournamentId = tournamentRes.body.id;

    const startBody = {
      teamIds,
      // 5 equipos -> clasificatoria (reduce a 4) + Semifinal + Final = 3 casos.
      cases: [
        { title: 'Clasificatoria', description: 'Caso de la clasificatoria' },
        { title: 'Semifinal', description: 'Caso de semifinal' },
        { title: 'Final', description: 'Caso de la final' },
      ],
      timerDurationSeconds: 300,
    };

    const firstStart = await request(app.getHttpServer())
      .post(`/tournaments/${tournamentId}/start`)
      .set('Authorization', `Bearer ${profesorToken}`)
      .send(startBody);
    expect(firstStart.status).toBe(201);
    expect(firstStart.body.kind).toBe('QUALIFYING_ROUND_STARTED');

    const secondStart = await request(app.getHttpServer())
      .post(`/tournaments/${tournamentId}/start`)
      .set('Authorization', `Bearer ${profesorToken}`)
      .send(startBody);
    expect(secondStart.status).toBe(409);
    expect(secondStart.body.message).toBe('El torneo ya fue iniciado');

    const tournamentsRes = await request(app.getHttpServer()).get('/tournaments');
    const found = tournamentsRes.body.find((t: { id: string }) => t.id === tournamentId);
    expect(found.status).toBe('QUALIFYING');
  });

  it('devuelve 404 al consultar un torneo inexistente', async () => {
    const response = await request(app.getHttpServer()).get(
      '/tournaments/00000000-0000-0000-0000-000000000000',
    );
    expect(response.status).toBe(404);
  });

  it('rechaza sin sesión las acciones de profesor, pero deja públicas las de equipo/proyector', async () => {
    // Sin token: crear/iniciar/juzgar torneos y matches debe rechazarse.
    await request(app.getHttpServer()).post('/tournaments').send({ name: 'Sin sesión' }).expect(401);
    await request(app.getHttpServer())
      .post('/tournaments/00000000-0000-0000-0000-000000000000/start')
      .send({ teamIds: [], cases: [{ title: 'x', description: 'x' }], timerDurationSeconds: 60 })
      .expect(401);
    await request(app.getHttpServer())
      .patch('/tournaments/00000000-0000-0000-0000-000000000000')
      .send({ name: 'x' })
      .expect(401);
    await request(app.getHttpServer()).delete('/tournaments/00000000-0000-0000-0000-000000000000').expect(401);
    await request(app.getHttpServer())
      .post('/tournaments/00000000-0000-0000-0000-000000000000/reset')
      .expect(401);
    await request(app.getHttpServer())
      .post('/matches/00000000-0000-0000-0000-000000000000/start')
      .send({})
      .expect(401);
    await request(app.getHttpServer())
      .post('/matches/00000000-0000-0000-0000-000000000000/verdict')
      .send({ teamId: 'x', approve: true })
      .expect(401);
    await request(app.getHttpServer())
      .post('/matches/00000000-0000-0000-0000-000000000000/restart')
      .expect(401);

    // Sin token: registrar equipo, listar equipos/torneos, ver un torneo/match y enviar
    // solución de clasificatoria deben seguir funcionando (equipos/proyector no se loguean).
    await request(app.getHttpServer())
      .post('/teams')
      .send({ name: 'Equipo Público', memberNames: ['Ana'] })
      .expect(201);
    await request(app.getHttpServer()).get('/teams').expect(200);
    await request(app.getHttpServer()).get('/tournaments').expect(200);
  });

  describe('Código único de equipo', () => {
    it('POST /teams devuelve un código, pero GET /teams (público) no lo incluye', async () => {
      const registerRes = await request(app.getHttpServer())
        .post('/teams')
        .send({ name: 'Los Tiburones', memberNames: ['Ana'] });
      expect(registerRes.status).toBe(201);
      expect(typeof registerRes.body.code).toBe('string');
      expect(registerRes.body.code).toHaveLength(6);

      const listRes = await request(app.getHttpServer()).get('/teams');
      const found = listRes.body.find((t: { id: string }) => t.id === registerRes.body.id);
      expect(found.code).toBeUndefined();
    });

    it('registrar dos veces el mismo nombre crea dos equipos con códigos distintos (ya no hay dedupe)', async () => {
      const first = await request(app.getHttpServer())
        .post('/teams')
        .send({ name: 'Equipo Duplicado', memberNames: ['Ana'] });
      const second = await request(app.getHttpServer())
        .post('/teams')
        .send({ name: 'Equipo Duplicado', memberNames: ['Beto'] });

      expect(first.body.id).not.toBe(second.body.id);
      expect(first.body.code).not.toBe(second.body.code);
    });

    it('POST /teams/rejoin encuentra el equipo por código (sin necesitar sesión)', async () => {
      const registerRes = await request(app.getHttpServer())
        .post('/teams')
        .send({ name: 'Equipo Rejoin', memberNames: ['Ana'] });

      const rejoinRes = await request(app.getHttpServer())
        .post('/teams/rejoin')
        .send({ code: registerRes.body.code });
      expect(rejoinRes.status).toBe(201);
      expect(rejoinRes.body.id).toBe(registerRes.body.id);

      const badRejoin = await request(app.getHttpServer()).post('/teams/rejoin').send({ code: 'ZZZZZZ' });
      expect(badRejoin.status).toBe(404);
    });

    it('GET /teams/roster requiere sesión y sí incluye el código', async () => {
      const registerRes = await request(app.getHttpServer())
        .post('/teams')
        .send({ name: 'Equipo Roster', memberNames: ['Ana'] });

      await request(app.getHttpServer()).get('/teams/roster').expect(401);

      const rosterRes = await request(app.getHttpServer())
        .get('/teams/roster')
        .set('Authorization', `Bearer ${profesorToken}`);
      expect(rosterRes.status).toBe(200);
      const found = rosterRes.body.find((t: { id: string }) => t.id === registerRes.body.id);
      expect(found.code).toBe(registerRes.body.code);
    });
  });

  describe('Eliminar equipo', () => {
    // El rechazo de borrar un equipo "en uso" depende de una consulta real
    // contra `matches`/`qualifying_round_participants` — el fake en memoria
    // que usa este e2e no la calcula sola (por diseño, ver
    // InMemoryTeamRepository.isInUse). Ese caso se prueba de verdad en
    // persistence.spec.ts contra SQLite real; aquí solo confirmamos el
    // camino feliz y que el endpoint requiere sesión.
    it('elimina un equipo libre', async () => {
      const freeTeam = await request(app.getHttpServer())
        .post('/teams')
        .send({ name: 'Equipo Libre E2E', memberNames: ['Ana'] });

      await request(app.getHttpServer()).delete(`/teams/${freeTeam.body.id}`).expect(401);

      await request(app.getHttpServer())
        .delete(`/teams/${freeTeam.body.id}`)
        .set('Authorization', `Bearer ${profesorToken}`)
        .expect(200);

      const listRes = await request(app.getHttpServer()).get('/teams');
      expect(listRes.body.find((t: { id: string }) => t.id === freeTeam.body.id)).toBeUndefined();
    });
  });
});
