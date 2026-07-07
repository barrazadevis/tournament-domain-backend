import { EntityId } from '../../domain/value-objects/entity-id';
import { UserRepository } from '../ports/user.repository';
import { SessionRepository } from '../ports/session.repository';

/**
 * Si esto dejara la tabla `users` en cero, el panel profesor quedaría
 * inaccesible para siempre (bootstrap ya está bloqueado una vez que existe
 * algún usuario, así que nadie podría volver a entrar). Por eso se rechaza
 * borrar al último usuario restante — invariante real, no over-engineering.
 */
export class DeleteUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly sessionRepository: SessionRepository,
  ) {}

  async execute(userId: string): Promise<void> {
    const total = await this.userRepository.count();
    if (total <= 1) {
      throw new Error('No puedes eliminar al último usuario');
    }

    const id = EntityId.fromString(userId);
    await this.sessionRepository.deleteAllForUser(id);
    await this.userRepository.delete(id);
  }
}
