import { EntityId } from '../../domain/value-objects/entity-id';

/**
 * Session no es una entidad de dominio rica: no tiene invariantes de
 * negocio propias más allá de "expiró o no", que es una consulta, no una
 * regla de construcción. Por eso vive como interfaz plana en el puerto en
 * vez de una clase en `domain/entities`.
 */
export interface Session {
  token: string;
  userId: EntityId;
  createdAt: Date;
  expiresAt: Date;
}

export interface SessionRepository {
  save(session: Session): Promise<void>;
  findByToken(token: string): Promise<Session | null>;
  deleteByToken(token: string): Promise<void>;
  deleteAllForUser(userId: EntityId): Promise<void>;
}
