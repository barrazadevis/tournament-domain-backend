import { EventEmitter } from 'node:events';

export interface TimerTickEvent {
  matchId: string;
  remainingSeconds: number;
}

export interface MatchUpdatedEvent {
  matchId: string;
}

export interface RoundAdvancedEvent {
  tournamentId: string;
  roundId: string;
}

export interface TournamentFinishedEvent {
  tournamentId: string;
  championTeamId: string;
}

/**
 * TournamentEventBus: Observer Pattern vía EventEmitter nativo de Node.
 *
 * Por qué existe: MatchTimerService y los casos de uso no deberían conocer
 * a los Gateways (eso acoplaría lógica de negocio a Socket.IO). En su lugar,
 * emiten eventos aquí; cada Gateway se suscribe a los que le interesan y
 * hace el broadcast a su propio namespace/room. Añadir un cuarto tipo de
 * cliente (ej. un dashboard de analítica) no requiere tocar el timer ni
 * los casos de uso — solo suscribirse a este bus.
 */
export class TournamentEventBus extends EventEmitter {
  emitTimerTick(event: TimerTickEvent): void {
    this.emit('timer_tick', event);
  }

  onTimerTick(listener: (event: TimerTickEvent) => void): void {
    this.on('timer_tick', listener);
  }

  emitMatchUpdated(event: MatchUpdatedEvent): void {
    this.emit('match_updated', event);
  }

  onMatchUpdated(listener: (event: MatchUpdatedEvent) => void): void {
    this.on('match_updated', listener);
  }

  emitRoundAdvanced(event: RoundAdvancedEvent): void {
    this.emit('round_advanced', event);
  }

  onRoundAdvanced(listener: (event: RoundAdvancedEvent) => void): void {
    this.on('round_advanced', listener);
  }

  emitTournamentFinished(event: TournamentFinishedEvent): void {
    this.emit('tournament_finished', event);
  }

  onTournamentFinished(listener: (event: TournamentFinishedEvent) => void): void {
    this.on('tournament_finished', listener);
  }
}
