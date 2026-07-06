import { MessageBody, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import { BaseTournamentGateway } from './base-tournament.gateway';
import { TournamentEventBus } from './tournament-event-bus';
import { StartMatchUseCase } from '../../application/use-cases/start-match.use-case';
import { JudgeMatchSubmissionUseCase } from '../../application/use-cases/judge-match-submission.use-case';
import { AdvanceToNextRoundUseCase } from '../../application/use-cases/advance-to-next-round.use-case';
import { MatchTimerService } from './match-timer.service';

interface StartMatchPayload {
  matchId: string;
  timerDurationSeconds: number;
}

interface JudgeVerdictPayload {
  matchId: string;
  approve: boolean;
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
 */
@WebSocketGateway({ namespace: '/judge', cors: { origin: '*' } })
export class JudgeGateway extends BaseTournamentGateway {
  constructor(
    eventBus: TournamentEventBus,
    private readonly startMatch: StartMatchUseCase,
    private readonly judgeMatchSubmission: JudgeMatchSubmissionUseCase,
    private readonly advanceToNextRound: AdvanceToNextRoundUseCase,
    private readonly matchTimer: MatchTimerService,
  ) {
    super(eventBus);
  }

  @SubscribeMessage('start_match')
  async handleStartMatch(@MessageBody() data: StartMatchPayload): Promise<void> {
    await this.startMatch.execute({ matchId: data.matchId, now: new Date() });
    this.matchTimer.start(data.matchId, data.timerDurationSeconds);
    this.eventBus.emitMatchUpdated({ matchId: data.matchId });
  }

  @SubscribeMessage('judge_verdict')
  async handleVerdict(@MessageBody() data: JudgeVerdictPayload): Promise<void> {
    const result = await this.judgeMatchSubmission.execute({
      matchId: data.matchId,
      approve: data.approve,
      now: new Date(),
    });

    // Solo detenemos el timer si el match quedó RESOLVED. Si el veredicto
    // fue un rechazo, el match vuelve a ACTIVE con el MISMO timer corriendo
    // (sin tiempo extra) — así lo definimos en el dominio.
    if (result.status === 'RESOLVED') {
      this.matchTimer.stop(data.matchId);
    }

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
