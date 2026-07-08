import { EntityId } from '../../../../domain/value-objects/entity-id';
import { BusinessCase, BusinessCaseTestCase, RequiredStructureType } from '../../../../domain/entities/business-case';

export interface BusinessCaseRow {
  id: string;
  title: string;
  description: string;
  structure_type: string;
  test_cases_json: string;
}

export class BusinessCaseMapper {
  static toDomain(row: BusinessCaseRow): BusinessCase {
    const testCases: BusinessCaseTestCase[] = JSON.parse(row.test_cases_json || '[]');
    return new BusinessCase(
      EntityId.fromString(row.id),
      row.title,
      row.description,
      row.structure_type as RequiredStructureType,
      testCases,
    );
  }

  static toRow(businessCase: BusinessCase): BusinessCaseRow {
    return {
      id: businessCase.getId().toString(),
      title: businessCase.getTitle(),
      description: businessCase.getDescription(),
      structure_type: businessCase.getStructureType(),
      test_cases_json: JSON.stringify(businessCase.getTestCases()),
    };
  }
}
