import { TeamRepository } from '../../../application/ports/team.repository';
import { EntityId } from '../../../domain/value-objects/entity-id';
import { Team } from '../../../domain/entities/team';
import { TournamentDatabase } from './database';
import { TeamMapper, TeamRow } from './mappers/team.mapper';

export class SqliteTeamRepository implements TeamRepository {
  constructor(private readonly db: TournamentDatabase) {}

  async save(team: Team): Promise<void> {
    const row = TeamMapper.toRow(team);
    this.db.connection
      .prepare(
        `INSERT INTO teams (id, name, members_json, eliminated_at, logo)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           members_json = excluded.members_json,
           eliminated_at = excluded.eliminated_at,
           logo = excluded.logo`,
      )
      .run(row.id, row.name, row.members_json, row.eliminated_at, row.logo);
  }

  async findById(id: EntityId): Promise<Team | null> {
    const row = this.db.connection
      .prepare('SELECT * FROM teams WHERE id = ?')
      .get(id.toString()) as unknown as TeamRow | undefined;
    return row ? TeamMapper.toDomain(row) : null;
  }

  async findByIds(ids: EntityId[]): Promise<Team[]> {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(', ');
    const rows = this.db.connection
      .prepare(`SELECT * FROM teams WHERE id IN (${placeholders})`)
      .all(...ids.map((id) => id.toString())) as unknown as TeamRow[];
    return rows.map(TeamMapper.toDomain);
  }

  async findByName(name: string): Promise<Team | null> {
    const row = this.db.connection
      .prepare('SELECT * FROM teams WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))')
      .get(name) as unknown as TeamRow | undefined;
    return row ? TeamMapper.toDomain(row) : null;
  }

  async findAll(): Promise<Team[]> {
    const rows = this.db.connection.prepare('SELECT * FROM teams').all() as unknown as TeamRow[];
    return rows.map(TeamMapper.toDomain);
  }
}
