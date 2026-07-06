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
} from '../src/infrastructure/http/tokens';
import {
  InMemoryTeamRepository,
  InMemoryTournamentRepository,
  InMemoryBusinessCaseRepository,
  InMemoryQualifyingRoundRepository,
} from './fakes/in-memory-repositories';

describe('Tournament API (E2E)', () => {
  let app: INestApplication;

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
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
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
      .send({ name: 'Torneo E2E' });
    expect(tournamentRes.status).toBe(201);
    const tournamentId = tournamentRes.body.id;

    const startRes = await request(app.getHttpServer())
      .post(`/tournaments/${tournamentId}/start`)
      .send({
        teamIds,
        caseTitle: 'Bono de vendedores',
        caseDescription: 'Diseñar el ciclo para el bono de 20 vendedores',
        timerDurationSeconds: 300,
      });
    expect(startRes.status).toBe(201);
    expect(startRes.body.kind).toBe('BRACKET_STARTED');

    const getRes = await request(app.getHttpServer()).get(`/tournaments/${tournamentId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.rounds).toHaveLength(1);
    expect(getRes.body.rounds[0].matches).toHaveLength(4);

    const firstMatch = getRes.body.rounds[0].matches[0];

    await request(app.getHttpServer()).post(`/matches/${firstMatch.id}/start`).send({}).expect(201);

    await request(app.getHttpServer())
      .post(`/matches/${firstMatch.id}/submissions`)
      .send({ teamId: firstMatch.teamAId, content: 'Estructura Para' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/matches/${firstMatch.id}/verdict`)
      .send({ approve: true })
      .expect(201);

    const afterVerdict = await request(app.getHttpServer()).get(`/tournaments/${tournamentId}`);
    const updatedMatch = afterVerdict.body.rounds[0].matches.find(
      (m: { id: string }) => m.id === firstMatch.id,
    );
    expect(updatedMatch.status).toBe('RESOLVED');
    expect(updatedMatch.winnerId).toBe(firstMatch.teamAId);
  });

  it('devuelve 404 al consultar un torneo inexistente', async () => {
    const response = await request(app.getHttpServer()).get(
      '/tournaments/00000000-0000-0000-0000-000000000000',
    );
    expect(response.status).toBe(404);
  });
});
