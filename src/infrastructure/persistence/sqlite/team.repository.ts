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
        `INSERT INTO teams (id, name, members_json, eliminated_at, logo, code)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           members_json = excluded.members_json,
           eliminated_at = excluded.eliminated_at,
           logo = excluded.logo,
           code = excluded.code`,
      )
      .run(row.id, row.name, row.members_json, row.eliminated_at, row.logo, row.code);
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

  async findByCode(code: string): Promise<Team | null> {
    const row = this.db.connection
      .prepare('SELECT * FROM teams WHERE code = ?')
      .get(code.trim().toUpperCase()) as unknown as TeamRow | undefined;
    return row ? TeamMapper.toDomain(row) : null;
  }

  async findAll(): Promise<Team[]> {
    const rows = this.db.connection.prepare('SELECT * FROM teams').all() as unknown as TeamRow[];
    return rows.map(TeamMapper.toDomain);
  }

  async delete(id: EntityId): Promise<void> {
    this.db.connection.prepare('DELETE FROM teams WHERE id = ?').run(id.toString());
  }

  /**
   * `qualifying_round_participants`/`qualifying_submissions` no tienen FK
   * hacia `teams` en el schema (a diferencia de `matches`, que sí) — sin
   * esta verificación explícita, borrar un equipo a mitad de una
   * clasificatoria dejaría filas huérfanas sin que SQLite lo impida.
   */
  async isInUse(id: EntityId): Promise<boolean> {
    const row = this.db.connection
      .prepare(
        `SELECT 1 FROM matches WHERE team_a_id = ? OR team_b_id = ?
         UNION
         SELECT 1 FROM qualifying_round_participants WHERE team_id = ?
         LIMIT 1`,
      )
      .get(id.toString(), id.toString(), id.toString());
    return !!row;
  }
}
