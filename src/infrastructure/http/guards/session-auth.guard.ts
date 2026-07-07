import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { SessionRepository } from '../../../application/ports/session.repository';
import { UserRepository } from '../../../application/ports/user.repository';
import { SESSION_REPOSITORY, USER_REPOSITORY } from '../tokens';

export interface AuthenticatedRequestUser {
  id: string;
  email: string;
}

/**
 * Único guard de la app: registrado como provider en `app.module.ts` para
 * que reciba los repos por constructor, igual que cualquier otro provider
 * (Nest resuelve guards referenciados por clase a través del contenedor DI).
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessionRepository: SessionRepository,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers?.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : undefined;

    if (!token) {
      throw new UnauthorizedException('Falta el token de sesión');
    }

    const session = await this.sessionRepository.findByToken(token);
    if (!session) {
      throw new UnauthorizedException('Sesión inválida o expirada');
    }

    const user = await this.userRepository.findById(session.userId);
    if (!user) {
      throw new UnauthorizedException('Sesión inválida o expirada');
    }

    const requestUser: AuthenticatedRequestUser = { id: user.getId().toString(), email: user.getEmail() };
    request.user = requestUser;
    request.sessionToken = token;
    return true;
  }
}
