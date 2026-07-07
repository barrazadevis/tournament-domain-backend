import { EntityId } from '../../domain/value-objects/entity-id';
import { User } from '../../domain/entities/user';

export interface UserRepository {
  save(user: User): Promise<void>;
  findById(id: EntityId): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findAll(): Promise<User[]>;
  delete(id: EntityId): Promise<void>;
  count(): Promise<number>;
}
