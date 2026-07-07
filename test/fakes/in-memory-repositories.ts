import { EntityId } from '../../src/domain/value-objects/entity-id';
import { Team } from '../../src/domain/entities/team';
import { Tournament } from '../../src/domain/entities/tournament';
import { BusinessCase } from '../../src/domain/entities/business-case';
import { QualifyingRound } from '../../src/domain/entities/qualifying-round';
import { User } from '../../src/domain/entities/user';
import { TeamRepository } from '../../src/application/ports/team.repository';
import { TournamentRepository } from '../../src/application/ports/tournament.repository';
import { BusinessCaseRepository } from '../../src/application/ports/business-case.repository';
import { QualifyingRoundRepository } from '../../src/application/ports/qualifying-round.repository';
import { UserRepository } from '../../src/application/ports/user.repository';
import { SessionRepository, Session } from '../../src/application/ports/session.repository';
import { PasswordHasher } from '../../src/application/ports/password-hasher';

/**
 * Fakes en memoria: como las entidades de dominio ya son el objeto real
 * (no filas planas), simplemente las guardamos en un Map por id. Esto
 * aísla los tests de casos de uso de cualquier bug de mapeo SQL — esos ya
 * se prueban aparte en test/persistence.spec.ts contra SQLite real.
 */
export class InMemoryTeamRepository implements TeamRepository {
  private readonly store = new Map<string, Team>();

  async save(team: Team): Promise<void> {
    this.store.set(team.getId().toString(), team);
  }

  async findById(id: EntityId): Promise<Team | null> {
    return this.store.get(id.toString()) ?? null;
  }

  async findByIds(ids: EntityId[]): Promise<Team[]> {
    return ids
      .map((id) => this.store.get(id.toString()))
      .filter((t): t is Team => t !== undefined);
  }

  async findByName(name: string): Promise<Team | null> {
    const normalized = name.trim().toLowerCase();
    for (const team of this.store.values()) {
      if (team.getName().trim().toLowerCase() === normalized) return team;
    }
    return null;
  }

  async findByCode(code: string): Promise<Team | null> {
    const normalized = code.trim().toUpperCase();
    for (const team of this.store.values()) {
      if (team.getCode().toString() === normalized) return team;
    }
    return null;
  }

  async findAll(): Promise<Team[]> {
    return [...this.store.values()];
  }

  async delete(id: EntityId): Promise<void> {
    this.store.delete(id.toString());
  }

  /** Los tests marcan aquí qué equipos "ya están en un torneo" — el fake no
   * tiene acceso a InMemoryTournamentRepository/InMemoryQualifyingRoundRepository
   * para calcularlo solo (eso sí se prueba de verdad contra SQLite real en
   * persistence.spec.ts). */
  private readonly inUseIds = new Set<string>();

  markInUse(id: string): void {
    this.inUseIds.add(id);
  }

  async isInUse(id: EntityId): Promise<boolean> {
    return this.inUseIds.has(id.toString());
  }
}

export class InMemoryTournamentRepository implements TournamentRepository {
  private readonly store = new Map<string, Tournament>();

  async save(tournament: Tournament): Promise<void> {
    this.store.set(tournament.getId().toString(), tournament);
  }

  async findById(id: EntityId): Promise<Tournament | null> {
    return this.store.get(id.toString()) ?? null;
  }

  async findAll(): Promise<Tournament[]> {
    return [...this.store.values()];
  }

  async findByMatchId(matchId: EntityId): Promise<Tournament | null> {
    for (const tournament of this.store.values()) {
      if (tournament.findMatch(matchId)) return tournament;
    }
    return null;
  }

  async delete(id: EntityId): Promise<void> {
    this.store.delete(id.toString());
  }

  async reset(id: EntityId): Promise<void> {
    const tournament = this.store.get(id.toString());
    tournament?.resetToDraft();
  }
}

export class InMemoryBusinessCaseRepository implements BusinessCaseRepository {
  private readonly store = new Map<string, BusinessCase>();

  async save(businessCase: BusinessCase): Promise<void> {
    this.store.set(businessCase.getId().toString(), businessCase);
  }

  async findById(id: EntityId): Promise<BusinessCase | null> {
    return this.store.get(id.toString()) ?? null;
  }
}

export class InMemoryQualifyingRoundRepository implements QualifyingRoundRepository {
  private readonly store = new Map<string, QualifyingRound>();

  async save(round: QualifyingRound, tournamentId: EntityId): Promise<void> {
    this.store.set(tournamentId.toString(), round);
  }

  async findByTournamentId(tournamentId: EntityId): Promise<QualifyingRound | null> {
    return this.store.get(tournamentId.toString()) ?? null;
  }
}

export class InMemoryUserRepository implements UserRepository {
  private readonly store = new Map<string, User>();

  async save(user: User): Promise<void> {
    this.store.set(user.getId().toString(), user);
  }

  async findById(id: EntityId): Promise<User | null> {
    return this.store.get(id.toString()) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalized = email.trim().toLowerCase();
    for (const user of this.store.values()) {
      if (user.getEmail() === normalized) return user;
    }
    return null;
  }

  async findAll(): Promise<User[]> {
    return [...this.store.values()];
  }

  async delete(id: EntityId): Promise<void> {
    this.store.delete(id.toString());
  }

  async count(): Promise<number> {
    return this.store.size;
  }
}

export class InMemorySessionRepository implements SessionRepository {
  private readonly store = new Map<string, Session>();

  async save(session: Session): Promise<void> {
    this.store.set(session.token, session);
  }

  async findByToken(token: string): Promise<Session | null> {
    const session = this.store.get(token);
    if (!session) return null;
    if (session.expiresAt.getTime() <= Date.now()) {
      this.store.delete(token);
      return null;
    }
    return session;
  }

  async deleteByToken(token: string): Promise<void> {
    this.store.delete(token);
  }

  async deleteAllForUser(userId: EntityId): Promise<void> {
    for (const [token, session] of this.store) {
      if (session.userId.equals(userId)) this.store.delete(token);
    }
  }
}

/** Fake rápido para tests: evita el costo de scrypt real en cada caso de uso. */
export class FakePasswordHasher implements PasswordHasher {
  async hash(plain: string): Promise<string> {
    return `hashed:${plain}`;
  }

  async verify(plain: string, hash: string): Promise<boolean> {
    return hash === `hashed:${plain}`;
  }
}
