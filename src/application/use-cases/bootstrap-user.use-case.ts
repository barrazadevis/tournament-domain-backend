import { randomBytes } from 'node:crypto';
import { User } from '../../domain/entities/user';
import { UserRepository } from '../ports/user.repository';
import { SessionRepository } from '../ports/session.repository';
import { RegisterUserUseCase, RegisterUserInput } from './register-user.use-case';

/** Duración de una sesión: aprox. una clase (12h). */
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export interface BootstrapResult {
  user: User;
  token: string;
}

/**
 * Crea el primer profesor de la instalación y lo loguea de una. Solo
 * funciona mientras no exista ningún usuario — una vez que hay al menos
 * uno, este caso de uso queda inutilizable y la gestión de usuarios
 * adicionales pasa por `RegisterUserUseCase` detrás de un login válido.
 * Evita depender de variables de entorno para sembrar un admin inicial
 * (el backend hoy no tiene ningún manejo de env vars).
 */
export class BootstrapUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly registerUser: RegisterUserUseCase,
  ) {}

  async execute(input: RegisterUserInput): Promise<BootstrapResult> {
    const existingCount = await this.userRepository.count();
    if (existingCount > 0) {
      throw new Error('Ya existe un usuario registrado; usa login o pide que te agreguen desde Configuración');
    }

    const user = await this.registerUser.execute(input);

    const token = randomBytes(32).toString('hex');
    const now = new Date();
    await this.sessionRepository.save({
      token,
      userId: user.getId(),
      createdAt: now,
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
    });

    return { user, token };
  }
}
