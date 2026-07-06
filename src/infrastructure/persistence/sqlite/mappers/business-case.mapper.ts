import { EntityId } from '../../../../domain/value-objects/entity-id';
import { BusinessCase, RequiredStructureType } from '../../../../domain/entities/business-case';

export interface BusinessCaseRow {
  id: string;
  title: string;
  description: string;
  structure_type: string;
}

export class BusinessCaseMapper {
  static toDomain(row: BusinessCaseRow): BusinessCase {
    return new BusinessCase(
      EntityId.fromString(row.id),
      row.title,
      row.description,
      row.structure_type as RequiredStructureType,
    );
  }

  static toRow(businessCase: BusinessCase): BusinessCaseRow {
    return {
      id: businessCase.getId().toString(),
      title: businessCase.getTitle(),
      description: businessCase.getDescription(),
      structure_type: businessCase.getStructureType(),
    };
  }
}
