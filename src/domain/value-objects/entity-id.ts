import { randomUUID } from 'crypto';

/**
 * Value Object que encapsula un identificador único.
 *
 * Por qué existe: sin esto, cualquier función podría recibir un string
 * cualquiera donde se espera un TeamId o MatchId, y TypeScript no lo
 * detectaría (ambos son "string"). Con esta clase, un TeamId y un MatchId
 * son tipos incompatibles entre sí, aunque ambos envuelvan un string.
 */
export class EntityId {
  private readonly value: string;

  private constructor(value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('EntityId no puede estar vacío');
    }
    this.value = value;
  }

  static generate(): EntityId {
    return new EntityId(randomUUID());
  }

  static fromString(value: string): EntityId {
    return new EntityId(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: EntityId): boolean {
    return this.value === other.value;
  }
}
