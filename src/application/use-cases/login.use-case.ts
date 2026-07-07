import { randomBytes } from 'node:crypto';
import { User } from '../../domain/entities/user';
import { UserRepository } from '../ports/user.repository';
import { SessionRepository } from '../ports/session.repository';
import { PasswordHasher } from '../ports/password-hasher';
import { SESSION_TTL_MS } from './bootstrap-user.use-case';

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResult {
  user: User;
  token: string;
}

export class LoginUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(input: LoginInput): Promise<LoginResult> {
    const user = await this.userRepository.findByEmail(input.email);
    if (!user) {
      throw new Error('Credenciales inválidas');
    }

    const validPassword = await this.passwordHasher.verify(input.password, user.getPasswordHash());
    if (!validPassword) {
      throw new Error('Credenciales inválidas');
    }

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
