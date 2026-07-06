import { WebSocketGateway } from '@nestjs/websockets';
import { BaseTournamentGateway } from './base-tournament.gateway';
import { TournamentEventBus } from './tournament-event-bus';

/**
 * ViewerGateway: namespace de solo lectura para la pantalla del proyector.
 * A propósito no tiene ningún @SubscribeMessage propio más allá de los
 * heredados (join_match/join_tournament) — un cliente conectado aquí no
 * puede escribir nada, ni por error de implementación en el frontend.
 *
 * Nota: el constructor explícito es necesario aunque solo llame a super().
 * Si una clase hija no declara su propio constructor, TypeScript no emite
 * metadata de tipos para ESA clase, y NestJS termina invocándola sin
 * argumentos (rompiendo la inyección de TournamentEventBus heredada).
 */
@WebSocketGateway({ namespace: '/viewer', cors: { origin: '*' } })
export class ViewerGateway extends BaseTournamentGateway {
  constructor(eventBus: TournamentEventBus) {
    super(eventBus);
  }
}
