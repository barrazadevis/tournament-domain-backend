import {
  OnGatewayInit,
  SubscribeMessage,
  WebSocketServer,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { TournamentEventBus } from './tournament-event-bus';

/**
 * BaseTournamentGateway: lógica común a los 3 namespaces (team/judge/viewer).
 *
 * Unirse a salas por match o por torneo, y reenviar lo que llega del
 * TournamentEventBus, es idéntico sin importar el rol — solo cambian los
 * handlers de eventos ENTRANTES (submit_solution, judge_verdict, etc.),
 * que cada subclase agrega. Evita repetir esta lógica 3 veces (DRY).
 */
export abstract class BaseTournamentGateway implements OnGatewayInit {
  @WebSocketServer()
  server!: Server;

  constructor(protected readonly eventBus: TournamentEventBus) {}

  afterInit(server: Server): void {
    this.eventBus.onTimerTick((event) => {
      server.to(`match:${event.matchId}`).emit('timer_tick', event);
    });
    this.eventBus.onMatchUpdated((event) => {
      server.to(`match:${event.matchId}`).emit('match_updated', event);
    });
    this.eventBus.onRoundAdvanced((event) => {
      server.to(`tournament:${event.tournamentId}`).emit('round_advanced', event);
    });
    this.eventBus.onTournamentFinished((event) => {
      server.to(`tournament:${event.tournamentId}`).emit('tournament_finished', event);
    });
  }

  @SubscribeMessage('join_match')
  handleJoinMatch(@ConnectedSocket() client: Socket, @MessageBody() data: { matchId: string }): void {
    client.join(`match:${data.matchId}`);
  }

  @SubscribeMessage('join_tournament')
  handleJoinTournament(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tournamentId: string },
  ): void {
    client.join(`tournament:${data.tournamentId}`);
  }
}
