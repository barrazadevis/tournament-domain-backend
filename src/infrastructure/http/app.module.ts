import { Module } from '@nestjs/common';
import { join } from 'node:path';
import { TournamentDatabase } from '../persistence/sqlite/database';
import { SqliteTeamRepository } from '../persistence/sqlite/team.repository';
import { SqliteTournamentRepository } from '../persistence/sqlite/tournament.repository';
import { SqliteBusinessCaseRepository } from '../persistence/sqlite/business-case.repository';
import { SqliteQualifyingRoundRepository } from '../persistence/sqlite/qualifying-round.repository';
import { TeamRepository } from '../../application/ports/team.repository';
import { TournamentRepository } from '../../application/ports/tournament.repository';
import { BusinessCaseRepository } from '../../application/ports/business-case.repository';
import { QualifyingRoundRepository } from '../../application/ports/qualifying-round.repository';
import { RegisterTeamUseCase } from '../../application/use-cases/register-team.use-case';
import { CreateTournamentUseCase } from '../../application/use-cases/create-tournament.use-case';
import { StartTournamentUseCase } from '../../application/use-cases/start-tournament.use-case';
import { SubmitQualifyingSolutionUseCase } from '../../application/use-cases/submit-qualifying-solution.use-case';
import { JudgeQualifyingSubmissionUseCase } from '../../application/use-cases/judge-qualifying-submission.use-case';
import { FinalizeQualifyingRoundUseCase } from '../../application/use-cases/finalize-qualifying-round.use-case';
import { StartMatchUseCase } from '../../application/use-cases/start-match.use-case';
import { SubmitMatchSolutionUseCase } from '../../application/use-cases/submit-match-solution.use-case';
import { JudgeMatchSubmissionUseCase } from '../../application/use-cases/judge-match-submission.use-case';
import { AdvanceToNextRoundUseCase } from '../../application/use-cases/advance-to-next-round.use-case';
import { ExpireMatchTimerUseCase } from '../../application/use-cases/expire-match-timer.use-case';
import { RenameTournamentUseCase } from '../../application/use-cases/rename-tournament.use-case';
import { DeleteTournamentUseCase } from '../../application/use-cases/delete-tournament.use-case';
import { ResetTournamentUseCase } from '../../application/use-cases/reset-tournament.use-case';
import { TeamsController } from './controllers/teams.controller';
import { TournamentsController } from './controllers/tournaments.controller';
import { MatchesController } from './controllers/matches.controller';
import { TournamentEventBus } from '../websockets/tournament-event-bus';
import { MatchTimerService } from '../websockets/match-timer.service';
import { TeamGateway } from '../websockets/team.gateway';
import { JudgeGateway } from '../websockets/judge.gateway';
import { ViewerGateway } from '../websockets/viewer.gateway';
import {
  TEAM_REPOSITORY,
  TOURNAMENT_REPOSITORY,
  BUSINESS_CASE_REPOSITORY,
  QUALIFYING_ROUND_REPOSITORY,
  TOURNAMENT_DATABASE,
} from './tokens';

/**
 * Composición explícita vía useFactory: los casos de uso son clases planas
 * de TypeScript (Fase 3), sin @Injectable ni ningún import de NestJS — el
 * dominio y la capa de aplicación no saben que este framework existe
 * (Dependency Inversion llevada hasta el módulo). El costo es más verbosidad
 * aquí, que es exactamente donde debe pagarse ese costo: en el Composition
 * Root, no esparcido por el código de negocio.
 */
@Module({
  controllers: [TeamsController, TournamentsController, MatchesController],
  providers: [
    {
      provide: TOURNAMENT_DATABASE,
      useFactory: () => new TournamentDatabase(join(process.cwd(), 'tournament.db')),
    },
    {
      provide: TEAM_REPOSITORY,
      useFactory: (db: TournamentDatabase) => new SqliteTeamRepository(db),
      inject: [TOURNAMENT_DATABASE],
    },
    {
      provide: TOURNAMENT_REPOSITORY,
      useFactory: (db: TournamentDatabase) => new SqliteTournamentRepository(db),
      inject: [TOURNAMENT_DATABASE],
    },
    {
      provide: BUSINESS_CASE_REPOSITORY,
      useFactory: (db: TournamentDatabase) => new SqliteBusinessCaseRepository(db),
      inject: [TOURNAMENT_DATABASE],
    },
    {
      provide: QUALIFYING_ROUND_REPOSITORY,
      useFactory: (db: TournamentDatabase, teamRepo: TeamRepository) =>
        new SqliteQualifyingRoundRepository(db, teamRepo as SqliteTeamRepository),
      inject: [TOURNAMENT_DATABASE, TEAM_REPOSITORY],
    },
    {
      provide: RegisterTeamUseCase,
      useFactory: (teamRepo: TeamRepository) => new RegisterTeamUseCase(teamRepo),
      inject: [TEAM_REPOSITORY],
    },
    {
      provide: CreateTournamentUseCase,
      useFactory: (tournamentRepo: TournamentRepository) =>
        new CreateTournamentUseCase(tournamentRepo),
      inject: [TOURNAMENT_REPOSITORY],
    },
    {
      provide: StartTournamentUseCase,
      useFactory: (
        tournamentRepo: TournamentRepository,
        teamRepo: TeamRepository,
        caseRepo: BusinessCaseRepository,
        qualifyingRepo: QualifyingRoundRepository,
      ) => new StartTournamentUseCase(tournamentRepo, teamRepo, caseRepo, qualifyingRepo),
      inject: [
        TOURNAMENT_REPOSITORY,
        TEAM_REPOSITORY,
        BUSINESS_CASE_REPOSITORY,
        QUALIFYING_ROUND_REPOSITORY,
      ],
    },
    {
      provide: SubmitQualifyingSolutionUseCase,
      useFactory: (qualifyingRepo: QualifyingRoundRepository) =>
        new SubmitQualifyingSolutionUseCase(qualifyingRepo),
      inject: [QUALIFYING_ROUND_REPOSITORY],
    },
    {
      provide: JudgeQualifyingSubmissionUseCase,
      useFactory: (qualifyingRepo: QualifyingRoundRepository) =>
        new JudgeQualifyingSubmissionUseCase(qualifyingRepo),
      inject: [QUALIFYING_ROUND_REPOSITORY],
    },
    {
      provide: FinalizeQualifyingRoundUseCase,
      useFactory: (
        tournamentRepo: TournamentRepository,
        teamRepo: TeamRepository,
        qualifyingRepo: QualifyingRoundRepository,
      ) => new FinalizeQualifyingRoundUseCase(tournamentRepo, teamRepo, qualifyingRepo),
      inject: [TOURNAMENT_REPOSITORY, TEAM_REPOSITORY, QUALIFYING_ROUND_REPOSITORY],
    },
    {
      provide: StartMatchUseCase,
      useFactory: (tournamentRepo: TournamentRepository) => new StartMatchUseCase(tournamentRepo),
      inject: [TOURNAMENT_REPOSITORY],
    },
    {
      provide: SubmitMatchSolutionUseCase,
      useFactory: (tournamentRepo: TournamentRepository) =>
        new SubmitMatchSolutionUseCase(tournamentRepo),
      inject: [TOURNAMENT_REPOSITORY],
    },
    {
      provide: JudgeMatchSubmissionUseCase,
      useFactory: (tournamentRepo: TournamentRepository) =>
        new JudgeMatchSubmissionUseCase(tournamentRepo),
      inject: [TOURNAMENT_REPOSITORY],
    },
    {
      provide: AdvanceToNextRoundUseCase,
      useFactory: (tournamentRepo: TournamentRepository) =>
        new AdvanceToNextRoundUseCase(tournamentRepo),
      inject: [TOURNAMENT_REPOSITORY],
    },
    {
      provide: ExpireMatchTimerUseCase,
      useFactory: (tournamentRepo: TournamentRepository) =>
        new ExpireMatchTimerUseCase(tournamentRepo),
      inject: [TOURNAMENT_REPOSITORY],
    },
    {
      provide: RenameTournamentUseCase,
      useFactory: (tournamentRepo: TournamentRepository) => new RenameTournamentUseCase(tournamentRepo),
      inject: [TOURNAMENT_REPOSITORY],
    },
    {
      provide: DeleteTournamentUseCase,
      useFactory: (tournamentRepo: TournamentRepository) => new DeleteTournamentUseCase(tournamentRepo),
      inject: [TOURNAMENT_REPOSITORY],
    },
    {
      provide: ResetTournamentUseCase,
      useFactory: (tournamentRepo: TournamentRepository) => new ResetTournamentUseCase(tournamentRepo),
      inject: [TOURNAMENT_REPOSITORY],
    },
    { provide: TournamentEventBus, useClass: TournamentEventBus },
    {
      provide: MatchTimerService,
      useFactory: (expireTimer: ExpireMatchTimerUseCase, bus: TournamentEventBus) =>
        new MatchTimerService(expireTimer, bus),
      inject: [ExpireMatchTimerUseCase, TournamentEventBus],
    },
    TeamGateway,
    JudgeGateway,
    ViewerGateway,
  ],
})
export class AppModule {}
