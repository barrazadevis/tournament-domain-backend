import { EntityId } from '../../domain/value-objects/entity-id';
import { BusinessCase } from '../../domain/entities/business-case';

export interface BusinessCaseRepository {
  save(businessCase: BusinessCase): Promise<void>;
  findById(id: EntityId): Promise<BusinessCase | null>;
}
