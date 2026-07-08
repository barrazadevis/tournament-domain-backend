import { EntityId } from '../value-objects/entity-id';

export enum RequiredStructureType {
  SINGLE_STRUCTURE = 'SINGLE_STRUCTURE', // Cuartos: una sola estructura correcta
  JUSTIFY_BETWEEN_TWO = 'JUSTIFY_BETWEEN_TWO', // Semifinal: elegir entre dos válidas
  AMBIGUOUS = 'AMBIGUOUS', // Final: caso abierto, se evalúa el argumento
}

export interface BusinessCaseTestCase {
  input: string;
  expectedOutput: string;
}

/**
 * Entidad BusinessCase: el enunciado del caso empresarial que reciben
 * los dos equipos de un match (ej. "calcular el bono de 20 vendedores").
 *
 * `testCases` solo se usa cuando el torneo es de lenguaje PYTHON (ver
 * Tournament.language) — para PSeInt se queda vacío, el veredicto sigue
 * siendo 100% manual.
 */
export class BusinessCase {
  private readonly id: EntityId;
  private readonly title: string;
  private readonly description: string;
  private readonly structureType: RequiredStructureType;
  private readonly testCases: BusinessCaseTestCase[];

  constructor(
    id: EntityId,
    title: string,
    description: string,
    structureType: RequiredStructureType,
    testCases: BusinessCaseTestCase[] = [],
  ) {
    if (!title.trim() || !description.trim()) {
      throw new Error('El caso debe tener título y descripción');
    }
    this.id = id;
    this.title = title.trim();
    this.description = description.trim();
    this.structureType = structureType;
    this.testCases = testCases;
  }

  getId(): EntityId {
    return this.id;
  }

  getTitle(): string {
    return this.title;
  }

  getDescription(): string {
    return this.description;
  }

  getStructureType(): RequiredStructureType {
    return this.structureType;
  }

  getTestCases(): ReadonlyArray<BusinessCaseTestCase> {
    return this.testCases;
  }
}
