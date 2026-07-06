import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { BaseTournamentGateway } from './base-tournament.gateway';
import { TournamentEventBus } from './tournament-event-bus';
import { SubmitMatchSolutionUseCase } from '../../application/use-cases/submit-match-solution.use-case';
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
    } catch (error) {
      client.emit('submission_rejected', {
        matchId: data.matchId,
        reason: (error as Error).message,
      });
    }
  }
}
