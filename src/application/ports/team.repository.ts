import { EntityId } from '../../domain/value-objects/entity-id';
import { Team } from '../../domain/entities/team';

/**
 * Puerto (interfaz): el dominio y los casos de uso dependen de esto, nunca
 * de una implementación concreta (Dependency Inversion). Cambiar de SQLite
 * a Postgres en el futuro significa escribir un nuevo adapter, cero cambios
 * aquí ni en quien consume este puerto.
 */
export interface TeamRepository {
  save(team: Team): Promise<void>;
  findById(id: EntityId): Promise<Team | null>;
  findByIds(ids: EntityId[]): Promise<Team[]>;
  findByName(name: string): Promise<Team | null>;
  findAll(): Promise<Team[]>;
}
