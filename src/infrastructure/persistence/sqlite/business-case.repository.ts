import { BusinessCaseRepository } from '../../../application/ports/business-case.repository';
import { EntityId } from '../../../domain/value-objects/entity-id';
import { BusinessCase } from '../../../domain/entities/business-case';
import { TournamentDatabase } from './database';
import { BusinessCaseMapper, BusinessCaseRow } from './mappers/business-case.mapper';

export class SqliteBusinessCaseRepository implements BusinessCaseRepository {
  constructor(private readonly db: TournamentDatabase) {}

  async save(businessCase: BusinessCase): Promise<void> {
    const row = BusinessCaseMapper.toRow(businessCase);
    this.db.connection
      .prepare(
        `INSERT INTO business_cases (id, title, description, structure_type)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title,
           description = excluded.description,
           structure_type = excluded.structure_type`,
      )
      .run(row.id, row.title, row.description, row.structure_type);
  }

  async findById(id: EntityId): Promise<BusinessCase | null> {
    const row = this.db.connection
      .prepare('SELECT * FROM business_cases WHERE id = ?')
      .get(id.toString()) as unknown as BusinessCaseRow | undefined;
    return row ? BusinessCaseMapper.toDomain(row) : null;
  }
}
