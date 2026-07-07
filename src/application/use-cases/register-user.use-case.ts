import { EntityId } from '../../domain/value-objects/entity-id';
import { User } from '../../domain/entities/user';
import { UserRepository } from '../ports/user.repository';
import { PasswordHasher } from '../ports/password-hasher';

export interface RegisterUserInput {
  email: string;
  password: string;
}

/**
 * Crea un profesor nuevo. Lo reutilizan tanto `BootstrapUserUseCase` (primer
 * usuario, sin sesión previa) como el endpoint protegido `POST /users`
 * (un profesor ya logueado agrega a otro) — la única diferencia entre esos
 * dos flujos es quién puede llamarlos, una decisión de infraestructura
 * (guard), no de este caso de uso.
 */
export class RegisterUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(input: RegisterUserInput): Promise<User> {
    const existing = await this.userRepository.findByEmail(input.email);
    if (existing) {
      throw new Error('Ya existe un usuario con ese email');
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    const user = new User(EntityId.generate(), input.email, passwordHash);

    await this.userRepository.save(user);
    return user;
  }
}
