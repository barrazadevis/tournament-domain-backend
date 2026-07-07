import { SessionRepository } from '../ports/session.repository';

export class LogoutUseCase {
  constructor(private readonly sessionRepository: SessionRepository) {}

  async execute(token: string): Promise<void> {
    await this.sessionRepository.deleteByToken(token);
  }
}
