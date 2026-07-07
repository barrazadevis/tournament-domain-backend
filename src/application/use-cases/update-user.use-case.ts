import { EntityId } from '../../domain/value-objects/entity-id';
import { User } from '../../domain/entities/user';
import { UserRepository } from '../ports/user.repository';
import { PasswordHasher } from '../ports/password-hasher';

export interface UpdateUserInput {
  userId: string;
  email?: string;
  password?: string;
}

export class UpdateUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(input: UpdateUserInput): Promise<User> {
    const user = await this.userRepository.findById(EntityId.fromString(input.userId));
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    if (input.email) {
      const existing = await this.userRepository.findByEmail(input.email);
      if (existing && !existing.equals(user)) {
        throw new Error('Ya existe un usuario con ese email');
      }
      user.changeEmail(input.email);
    }

    if (input.password) {
      const passwordHash = await this.passwordHasher.hash(input.password);
      user.changePasswordHash(passwordHash);
    }

    await this.userRepository.save(user);
    return user;
  }
}
