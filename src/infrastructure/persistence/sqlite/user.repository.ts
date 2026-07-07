import { UserRepository } from '../../../application/ports/user.repository';
import { EntityId } from '../../../domain/value-objects/entity-id';
import { User } from '../../../domain/entities/user';
import { TournamentDatabase } from './database';
import { UserMapper, UserRow } from './mappers/user.mapper';

export class SqliteUserRepository implements UserRepository {
  constructor(private readonly db: TournamentDatabase) {}

  async save(user: User): Promise<void> {
    const row = UserMapper.toRow(user);
    this.db.connection
      .prepare(
        `INSERT INTO users (id, email, password_hash, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           email = excluded.email,
           password_hash = excluded.password_hash`,
      )
      .run(row.id, row.email, row.password_hash, row.created_at);
  }

  async findById(id: EntityId): Promise<User | null> {
    const row = this.db.connection
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(id.toString()) as unknown as UserRow | undefined;
    return row ? UserMapper.toDomain(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = this.db.connection
      .prepare('SELECT * FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM(?))')
      .get(email) as unknown as UserRow | undefined;
    return row ? UserMapper.toDomain(row) : null;
  }

  async findAll(): Promise<User[]> {
    const rows = this.db.connection.prepare('SELECT * FROM users').all() as unknown as UserRow[];
    return rows.map(UserMapper.toDomain);
  }

  async delete(id: EntityId): Promise<void> {
    this.db.connection.prepare('DELETE FROM users WHERE id = ?').run(id.toString());
  }

  async count(): Promise<number> {
    const row = this.db.connection.prepare('SELECT COUNT(*) as count FROM users').get() as unknown as {
      count: number;
    };
    return row.count;
  }
}
