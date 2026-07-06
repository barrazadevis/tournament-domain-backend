import { OnModuleDestroy } from '@nestjs/common';
import { ExpireMatchTimerUseCase } from '../../application/use-cases/expire-match-timer.use-case';
import { TournamentEventBus } from './tournament-event-bus';

const TICK_INTERVAL_MS = 1000;

/**
 * MatchTimerService: un intervalo por match activo, corriendo en el
 * servidor. Ningún cliente calcula su propio countdown — todos reciben el
 * mismo número por WebSocket, eliminando el drift de reloj entre
 * dispositivos que discutimos en el diseño.
 *
 * Implementa OnModuleDestroy para limpiar TODOS los intervalos al cerrar
 * la app — sin esto, cada test (o cada reinicio del proceso) deja
 * temporizadores huérfanos corriendo en memoria.
 */
export class MatchTimerService implements OnModuleDestroy {
  private readonly intervals = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly expireMatchTimer: ExpireMatchTimerUseCase,
    private readonly eventBus: TournamentEventBus,
  ) {}

  start(matchId: string, durationSeconds: number): void {
    this.stop(matchId); // por si ya había un intervalo previo (defensivo)

    const startedAt = Date.now();
    const interval = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
      const remainingSeconds = Math.max(0, durationSeconds - elapsedSeconds);

      this.eventBus.emitTimerTick({ matchId, remainingSeconds });

      if (remainingSeconds === 0) {
        this.stop(matchId);
        this.expireMatchTimer.execute({ matchId }).catch(() => {
          // Si el match ya fue resuelto por el juez justo antes de expirar
          // (race condition normal), expireTimer() es un no-op seguro —
          // ver Match.expireTimer() en el dominio. Cualquier otro error se
          // ignora aquí a propósito: el timer no debe tumbar el proceso.
        });
      }
    }, TICK_INTERVAL_MS);

    this.intervals.set(matchId, interval);
  }

  stop(matchId: string): void {
    const existing = this.intervals.get(matchId);
    if (existing) {
      clearInterval(existing);
      this.intervals.delete(matchId);
    }
  }

  isRunning(matchId: string): boolean {
    return this.intervals.has(matchId);
  }

  onModuleDestroy(): void {
    for (const interval of this.intervals.values()) {
      clearInterval(interval);
    }
    this.intervals.clear();
  }
}
