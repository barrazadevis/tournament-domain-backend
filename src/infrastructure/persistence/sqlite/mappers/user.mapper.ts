import { EntityId } from '../../../../domain/value-objects/entity-id';
import { User } from '../../../../domain/entities/user';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
}

export class UserMapper {
  static toDomain(row: UserRow): User {
    return User.rehydrate({
      id: EntityId.fromString(row.id),
      email: row.email,
      passwordHash: row.password_hash,
      createdAt: new Date(row.created_at),
    });
  }

  static toRow(user: User): UserRow {
    return {
      id: user.getId().toString(),
      email: user.getEmail(),
      password_hash: user.getPasswordHash(),
      created_at: user.getCreatedAt().toISOString(),
    };
  }
}
