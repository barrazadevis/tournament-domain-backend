import { EntityId } from '../value-objects/entity-id';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Entidad User: un profesor con acceso al panel de gestión. Solo existe un
 * rol (no hay admin/editor) — cualquier usuario registrado puede gestionar
 * a los demás, ver `RegisterUserUseCase`/`DeleteUserUseCase`.
 */
export class User {
  private readonly id: EntityId;
  private email: string;
  private passwordHash: string;
  private readonly createdAt: Date;

  constructor(id: EntityId, email: string, passwordHash: string, createdAt: Date = new Date()) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      throw new Error('El email no tiene un formato válido');
    }
    if (!passwordHash || passwordHash.trim().length === 0) {
      throw new Error('El hash de contraseña no puede estar vacío');
    }
    this.id = id;
    this.email = normalizedEmail;
    this.passwordHash = passwordHash;
    this.createdAt = createdAt;
  }

  getId(): EntityId {
    return this.id;
  }

  getEmail(): string {
    return this.email;
  }

  getPasswordHash(): string {
    return this.passwordHash;
  }

  getCreatedAt(): Date {
    return this.createdAt;
  }

  changeEmail(newEmail: string): void {
    const normalizedEmail = newEmail.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      throw new Error('El email no tiene un formato válido');
    }
    this.email = normalizedEmail;
  }

  changePasswordHash(newPasswordHash: string): void {
    if (!newPasswordHash || newPasswordHash.trim().length === 0) {
      throw new Error('El hash de contraseña no puede estar vacío');
    }
    this.passwordHash = newPasswordHash;
  }

  equals(other: User): boolean {
    return this.id.equals(other.id);
  }

  static rehydrate(props: { id: EntityId; email: string; passwordHash: string; createdAt: Date }): User {
    return new User(props.id, props.email, props.passwordHash, props.createdAt);
  }
}
