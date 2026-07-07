import { SessionRepository, Session } from '../../../application/ports/session.repository';
import { EntityId } from '../../../domain/value-objects/entity-id';
import { TournamentDatabase } from './database';

interface SessionRow {
  token: string;
  user_id: string;
  created_at: string;
  expires_at: string;
}

function toDomain(row: SessionRow): Session {
  return {
    token: row.token,
    userId: EntityId.fromString(row.user_id),
    createdAt: new Date(row.created_at),
    expiresAt: new Date(row.expires_at),
  };
}

export class SqliteSessionRepository implements SessionRepository {
  constructor(private readonly db: TournamentDatabase) {}

  async save(session: Session): Promise<void> {
    this.db.connection
      .prepare(
        `INSERT INTO sessions (token, user_id, created_at, expires_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(token) DO UPDATE SET
           expires_at = excluded.expires_at`,
      )
      .run(session.token, session.userId.toString(), session.createdAt.toISOString(), session.expiresAt.toISOString());
  }

  async findByToken(token: string): Promise<Session | null> {
    const row = this.db.connection
      .prepare('SELECT * FROM sessions WHERE token = ?')
      .get(token) as unknown as SessionRow | undefined;
    if (!row) return null;

    const session = toDomain(row);
    if (session.expiresAt.getTime() <= Date.now()) {
      await this.deleteByToken(token);
      return null;
    }
    return session;
  }

  async deleteByToken(token: string): Promise<void> {
    this.db.connection.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }

  async deleteAllForUser(userId: EntityId): Promise<void> {
    this.db.connection.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId.toString());
  }
}
