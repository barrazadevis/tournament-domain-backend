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

describe('Auth API (E2E)', () => {
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
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /auth/status reporta initialized:false antes del bootstrap', async () => {
    const response = await request(app.getHttpServer()).get('/auth/status');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ initialized: false });
  });

  it('flujo completo: bootstrap -> login -> acceder a /users con token -> rechazar sin token', async () => {
    const bootstrapRes = await request(app.getHttpServer())
      .post('/auth/bootstrap')
      .send({ email: 'profe@colegio.edu', password: 'claveSegura1' });
    expect(bootstrapRes.status).toBe(201);
    const { token } = bootstrapRes.body;
    expect(typeof token).toBe('string');

    const statusRes = await request(app.getHttpServer()).get('/auth/status');
    expect(statusRes.body).toEqual({ initialized: true });

    const noTokenRes = await request(app.getHttpServer()).get('/users');
    expect(noTokenRes.status).toBe(401);

    const withTokenRes = await request(app.getHttpServer()).get('/users').set('Authorization', `Bearer ${token}`);
    expect(withTokenRes.status).toBe(200);
    expect(withTokenRes.body).toHaveLength(1);
    expect(withTokenRes.body[0].email).toBe('profe@colegio.edu');
    expect(withTokenRes.body[0].passwordHash).toBeUndefined();

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'profe@colegio.edu', password: 'claveSegura1' });
    expect(loginRes.status).toBe(201);
    expect(typeof loginRes.body.token).toBe('string');

    const badLoginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'profe@colegio.edu', password: 'incorrecta' });
    expect(badLoginRes.status).toBe(401);
  });

  it('un segundo bootstrap falla con 409 una vez que ya hay un usuario', async () => {
    await request(app.getHttpServer())
      .post('/auth/bootstrap')
      .send({ email: 'profe@colegio.edu', password: 'claveSegura1' });

    const secondBootstrap = await request(app.getHttpServer())
      .post('/auth/bootstrap')
      .send({ email: 'otro@colegio.edu', password: 'claveSegura2' });
    expect(secondBootstrap.status).toBe(409);
  });

  it('rechaza eliminar al último usuario', async () => {
    const bootstrapRes = await request(app.getHttpServer())
      .post('/auth/bootstrap')
      .send({ email: 'profe@colegio.edu', password: 'claveSegura1' });
    const { token, user } = bootstrapRes.body;

    const deleteRes = await request(app.getHttpServer())
      .delete(`/users/${user.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(400);
  });

  it('logout invalida el token', async () => {
    const bootstrapRes = await request(app.getHttpServer())
      .post('/auth/bootstrap')
      .send({ email: 'profe@colegio.edu', password: 'claveSegura1' });
    const { token } = bootstrapRes.body;

    const logoutRes = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${token}`);
    expect(logoutRes.status).toBe(201);

    const meRes = await request(app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${token}`);
    expect(meRes.status).toBe(401);
  });
});
