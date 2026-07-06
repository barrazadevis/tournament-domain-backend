import { EntityId } from '../../src/domain/value-objects/entity-id';
import { Team } from '../../src/domain/entities/team';
import { Tournament } from '../../src/domain/entities/tournament';
import { BusinessCase } from '../../src/domain/entities/business-case';
import { QualifyingRound } from '../../src/domain/entities/qualifying-round';
import { TeamRepository } from '../../src/application/ports/team.repository';
import { TournamentRepository } from '../../src/application/ports/tournament.repository';
import { BusinessCaseRepository } from '../../src/application/ports/business-case.repository';
import { QualifyingRoundRepository } from '../../src/application/ports/qualifying-round.repository';

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

  async findAll(): Promise<Team[]> {
    return [...this.store.values()];
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
