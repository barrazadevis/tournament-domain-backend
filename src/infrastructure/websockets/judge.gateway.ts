import { Inject } from '@nestjs/common';
import { MessageBody, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { BaseTournamentGateway } from './base-tournament.gateway';
import { TournamentEventBus } from './tournament-event-bus';
import { StartMatchUseCase } from '../../application/use-cases/start-match.use-case';
import { JudgeMatchSubmissionUseCase } from '../../application/use-cases/judge-match-submission.use-case';
import { AdvanceToNextRoundUseCase } from '../../application/use-cases/advance-to-next-round.use-case';
import { RestartMatchUseCase } from '../../application/use-cases/restart-match.use-case';
import { MatchTimerService } from './match-timer.service';
import { SessionRepository } from '../../application/ports/session.repository';
import { SESSION_REPOSITORY } from '../http/tokens';

interface StartMatchPayload {
  matchId: string;
}

interface JudgeVerdictPayload {
  matchId: string;
  teamId: string;
  approve: boolean;
}

interface RestartMatchPayload {
  matchId: string;
}

interface AdvanceRoundPayload {
  tournamentId: string;
  currentRoundOrder: number;
  nextRoundName: string;
  timerDurationSeconds: number;
}

/**
 * JudgeGateway: namespace del profesor. Es el único de los 3 con permiso
 * para iniciar un match (arranca el timer server-side), dar veredicto, y
 * avanzar de ronda — refleja la tabla de roles definida en el diseño
 * original (Team/Judge/Viewer).
 *
 * A diferencia de TeamGateway/ViewerGateway, este SÍ requiere sesión: sin
 * esto, cualquiera que abriera una conexión de socket a `/judge` conociendo
 * el tournamentId (visible en su propia URL) podría emitir `start_match`,
 * `judge_verdict`, etc. como si fuera el profesor — el REST de
 * TournamentsController/MatchesController ya está protegido con
 * SessionAuthGuard, pero estas acciones nunca pasan por REST, van por acá.
 * La validación es solo en el handshake (una vez, al conectar) — no en cada
 * mensaje — igual que el resto de la app basa su sesión en un token opaco
 * verificado contra SQLite, no en un JWT firmado por request.
 */
@WebSocketGateway({ namespace: '/judge', cors: { origin: '*' } })
export class JudgeGateway extends BaseTournamentGateway {
  constructor(
    eventBus: TournamentEventBus,
    private readonly startMatch: StartMatchUseCase,
    private readonly judgeMatchSubmission: JudgeMatchSubmissionUseCase,
    private readonly advanceToNextRound: AdvanceToNextRoundUseCase,
    private readonly restartMatch: RestartMatchUseCase,
    private readonly matchTimer: MatchTimerService,
    @Inject(SESSION_REPOSITORY) private readonly sessionRepository: SessionRepository,
  ) {
    super(eventBus);
  }

  afterInit(server: Server): void {
    super.afterInit(server);
    server.use((socket: Socket, next) => {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) {
        next(new Error('No autorizado'));
        return;
      }
      this.sessionRepository
        .findByToken(token)
        .then((session) => next(session ? undefined : new Error('No autorizado')))
        .catch(() => next(new Error('No autorizado')));
    });
  }

  @SubscribeMessage('start_match')
  async handleStartMatch(@MessageBody() data: StartMatchPayload): Promise<void> {
    // La duración es la que ya quedó fija en el match cuando se generó la
    // ronda (BracketGenerationService/AdvanceToNextRoundUseCase) — "Iniciar
    // match" no puede cambiarla, solo arranca el timer con ese valor.
    const { timerDurationSeconds } = await this.startMatch.execute({ matchId: data.matchId, now: new Date() });
    this.matchTimer.start(data.matchId, timerDurationSeconds);
    this.eventBus.emitMatchUpdated({ matchId: data.matchId });
  }

  @SubscribeMessage('judge_verdict')
  async handleVerdict(@MessageBody() data: JudgeVerdictPayload): Promise<void> {
    const result = await this.judgeMatchSubmission.execute({
      matchId: data.matchId,
      teamId: data.teamId,
      approve: data.approve,
      now: new Date(),
    });

    // Solo detenemos el timer si el match quedó RESOLVED. Si el veredicto
    // fue un rechazo, el match vuelve a ACTIVE (o se queda en AWAITING_JUDGMENT
    // si el rival también tiene una submission pendiente) con el MISMO timer
    // corriendo (sin tiempo extra) — así lo definimos en el dominio.
    if (result.status === 'RESOLVED') {
      this.matchTimer.stop(data.matchId);
    }

    this.eventBus.emitMatchUpdated({ matchId: data.matchId });
  }

  @SubscribeMessage('restart_match')
  async handleRestartMatch(@MessageBody() data: RestartMatchPayload): Promise<void> {
    await this.restartMatch.execute({ matchId: data.matchId });
    this.eventBus.emitMatchUpdated({ matchId: data.matchId });
  }

  @SubscribeMessage('advance_round')
  async handleAdvanceRound(@MessageBody() data: AdvanceRoundPayload): Promise<void> {
    const result = await this.advanceToNextRound.execute(data);

    if (result.kind === 'TOURNAMENT_FINISHED') {
      this.eventBus.emitTournamentFinished({
        tournamentId: data.tournamentId,
        championTeamId: result.championTeamId,
      });
    } else {
      this.eventBus.emitRoundAdvanced({ tournamentId: data.tournamentId, roundId: result.roundId });
    }
  }
}
