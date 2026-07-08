import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { BaseTournamentGateway } from './base-tournament.gateway';
import { TournamentEventBus } from './tournament-event-bus';
import { SubmitMatchSolutionUseCase } from '../../application/use-cases/submit-match-solution.use-case';
import { RunSubmissionCodeUseCase } from '../../application/use-cases/run-submission-code.use-case';
import { MatchTimerService } from './match-timer.service';

interface SubmitSolutionPayload {
  matchId: string;
  teamId: string;
  content: string;
}

/**
 * TeamGateway: namespace del dispositivo del equipo. Solo puede enviar SU
 * propia solución — no tiene ningún handler que exponga la submission del
 * rival (esa lógica de "quién puede ver qué" es justo lo que motivó tener
 * 3 namespaces separados en vez de uno genérico).
 */
@WebSocketGateway({ namespace: '/team', cors: { origin: '*' } })
export class TeamGateway extends BaseTournamentGateway {
  constructor(
    eventBus: TournamentEventBus,
    private readonly submitMatchSolution: SubmitMatchSolutionUseCase,
    private readonly runSubmissionCode: RunSubmissionCodeUseCase,
    private readonly matchTimer: MatchTimerService,
  ) {
    super(eventBus);
  }

  @SubscribeMessage('submit_solution')
  async handleSubmitSolution(
    @MessageBody() data: SubmitSolutionPayload,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    try {
      const result = await this.submitMatchSolution.execute({
        matchId: data.matchId,
        teamId: data.teamId,
        content: data.content,
        submittedAt: new Date(),
      });

      // Si ya nadie más puede enviar (ambos enviaron o están descalificados),
      // seguir contando el timer no tiene sentido — solo falta el veredicto.
      if (result.shouldStopTimer) {
        this.matchTimer.stop(data.matchId);
      }

      this.eventBus.emitMatchUpdated({ matchId: data.matchId });
      client.emit('submission_accepted', { matchId: data.matchId });

      // Fire-and-forget: no bloquea la respuesta al equipo, y si Piston
      // falla/tarda, la submission ya quedó registrada de todos modos (es
      // no-op para torneos que no son Python — ver RunSubmissionCodeUseCase).
      // El .catch() es obligatorio: sin él, un rechazo no manejado puede
      // tumbar el proceso entero (unhandledRejection).
      this.runSubmissionCode
        .execute({ matchId: data.matchId, submissionId: result.submissionId })
        .then(() => this.eventBus.emitMatchUpdated({ matchId: data.matchId }))
        .catch(() => {
          // Ya se intentó — un fallo aquí no debe afectar al equipo, que ya
          // recibió su submission_accepted. Sin log estructurado en este
          // proyecto todavía; nada más que hacer del lado del servidor.
        });
    } catch (error) {
      client.emit('submission_rejected', {
        matchId: data.matchId,
        reason: (error as Error).message,
      });
    }
  }
}
