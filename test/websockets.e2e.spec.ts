import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { io, Socket as ClientSocket } from 'socket.io-client';
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
import { RegisterTeamUseCase } from '../src/application/use-cases/register-team.use-case';
import { CreateTournamentUseCase } from '../src/application/use-cases/create-tournament.use-case';
import { StartTournamentUseCase } from '../src/application/use-cases/start-tournament.use-case';

jest.setTimeout(15000);

function waitForEvent<T = unknown>(socket: ClientSocket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, resolve));
}

describe('Tournament WebSockets (E2E)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let teamRepository: InMemoryTeamRepository;
  let tournamentRepository: InMemoryTournamentRepository;

  beforeEach(async () => {
    teamRepository = new InMemoryTeamRepository();
    tournamentRepository = new InMemoryTournamentRepository();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(TOURNAMENT_DATABASE)
      .useValue({})
      .overrideProvider(TEAM_REPOSITORY)
      .useValue(teamRepository)
      .overrideProvider(TOURNAMENT_REPOSITORY)
      .useValue(tournamentRepository)
      .overrideProvider(BUSINESS_CASE_REPOSITORY)
      .useValue(new InMemoryBusinessCaseRepository())
      .overrideProvider(QUALIFYING_ROUND_REPOSITORY)
      .useValue(new InMemoryQualifyingRoundRepository())
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    const server = await app.listen(0);
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    baseUrl = `http://localhost:${port}`;
  });

  afterEach(async () => {
    await app.close();
  });

  it('el proyector recibe timer_tick y match_updated sin poder escribir nada', async () => {
    const registerTeam = new RegisterTeamUseCase(teamRepository);
    const createTournament = new CreateTournamentUseCase(tournamentRepository);
    const teamA = await registerTeam.execute({ name: 'Equipo A', memberNames: ['Ana'] });
    const teamB = await registerTeam.execute({ name: 'Equipo B', memberNames: ['Beto'] });
    const tournament = await createTournament.execute({ name: 'Torneo WS' });

    const startTournament = new StartTournamentUseCase(
      tournamentRepository,
      teamRepository,
      new InMemoryBusinessCaseRepository(),
      new InMemoryQualifyingRoundRepository(),
    );
    await startTournament.execute({
      tournamentId: tournament.getId().toString(),
      teamIds: [teamA.getId().toString(), teamB.getId().toString()],
      caseTitle: 'Bono',
      caseDescription: 'Descripción',
      timerDurationSeconds: 60,
    });

    const savedTournament = await tournamentRepository.findById(tournament.getId());
    const match = savedTournament!.getRounds()[0].getMatches()[0];

    const viewerSocket = io(`${baseUrl}/viewer`, { transports: ['websocket'] });
    const judgeSocket = io(`${baseUrl}/judge`, { transports: ['websocket'] });

    await Promise.all([
      waitForEvent(viewerSocket, 'connect'),
      waitForEvent(judgeSocket, 'connect'),
    ]);

    viewerSocket.emit('join_match', { matchId: match.getId().toString() });
    await new Promise((resolve) => setTimeout(resolve, 100)); // deja que el join se procese

    const matchUpdatedPromise = waitForEvent<{ matchId: string }>(viewerSocket, 'match_updated');
    const firstTickPromise = waitForEvent<{ matchId: string; remainingSeconds: number }>(
      viewerSocket,
      'timer_tick',
    );

    judgeSocket.emit('start_match', {
      matchId: match.getId().toString(),
      timerDurationSeconds: 60,
    });

    const matchUpdated = await matchUpdatedPromise;
    expect(matchUpdated.matchId).toBe(match.getId().toString());

    const firstTick = await firstTickPromise;
    expect(firstTick.matchId).toBe(match.getId().toString());
    expect(firstTick.remainingSeconds).toBeLessThanOrEqual(60);
    expect(firstTick.remainingSeconds).toBeGreaterThan(0);

    viewerSocket.close();
    judgeSocket.close();
  });

  it('team gateway acepta la solución propia y notifica match_updated al viewer', async () => {
    const registerTeam = new RegisterTeamUseCase(teamRepository);
    const createTournament = new CreateTournamentUseCase(tournamentRepository);
    const teamA = await registerTeam.execute({ name: 'Equipo A', memberNames: ['Ana'] });
    const teamB = await registerTeam.execute({ name: 'Equipo B', memberNames: ['Beto'] });
    const tournament = await createTournament.execute({ name: 'Torneo WS 2' });

    const startTournament = new StartTournamentUseCase(
      tournamentRepository,
      teamRepository,
      new InMemoryBusinessCaseRepository(),
      new InMemoryQualifyingRoundRepository(),
    );
    await startTournament.execute({
      tournamentId: tournament.getId().toString(),
      teamIds: [teamA.getId().toString(), teamB.getId().toString()],
      caseTitle: 'Bono',
      caseDescription: 'Descripción',
      timerDurationSeconds: 60,
    });

    const savedTournament = await tournamentRepository.findById(tournament.getId());
    const match = savedTournament!.getRounds()[0].getMatches()[0];

    const teamSocket = io(`${baseUrl}/team`, { transports: ['websocket'] });
    const judgeSocket = io(`${baseUrl}/judge`, { transports: ['websocket'] });
    await Promise.all([waitForEvent(teamSocket, 'connect'), waitForEvent(judgeSocket, 'connect')]);

    judgeSocket.emit('start_match', {
      matchId: match.getId().toString(),
      timerDurationSeconds: 60,
    });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const acceptedPromise = waitForEvent<{ matchId: string }>(teamSocket, 'submission_accepted');
    teamSocket.emit('submit_solution', {
      matchId: match.getId().toString(),
      teamId: teamA.getId().toString(),
      content: 'Estructura Para, justificación...',
    });

    const accepted = await acceptedPromise;
    expect(accepted.matchId).toBe(match.getId().toString());

    const afterSubmit = await tournamentRepository.findById(tournament.getId());
    const updatedMatch = afterSubmit!.findMatch(match.getId())!;
    expect(updatedMatch.getStatus()).toBe('AWAITING_JUDGMENT');

    teamSocket.close();
    judgeSocket.close();
  });
});
