import { EntityId } from '../value-objects/entity-id';

export interface TeamMember {
  fullName: string;
}

/**
 * Entidad Team: representa a un equipo inscrito en el torneo.
 *
 * Deliberadamente simple (poca lógica de negocio propia). Su complejidad
 * la absorbe Match y BracketAdvancementService, no Team.
 */
export class Team {
  private readonly id: EntityId;
  private readonly name: string;
  private readonly members: TeamMember[];
  private readonly logo: string | null;
  private eliminatedAt: Date | null = null;

  constructor(id: EntityId, name: string, members: TeamMember[], logo: string | null = null) {
    if (!name || name.trim().length === 0) {
      throw new Error('El nombre del equipo no puede estar vacío');
    }
    if (members.length === 0) {
      throw new Error('Un equipo debe tener al menos un integrante');
    }
    this.id = id;
    this.name = name.trim();
    this.members = [...members];
    this.logo = logo;
  }

  getId(): EntityId {
    return this.id;
  }

  getName(): string {
    return this.name;
  }

  getMembers(): ReadonlyArray<TeamMember> {
    return this.members;
  }

  getLogo(): string | null {
    return this.logo;
  }

  isEliminated(): boolean {
    return this.eliminatedAt !== null;
  }

  getEliminatedAt(): Date | null {
    return this.eliminatedAt;
  }

  eliminate(): void {
    this.eliminatedAt = new Date();
  }

  equals(other: Team): boolean {
    return this.id.equals(other.id);
  }

  static rehydrate(props: {
    id: EntityId;
    name: string;
    members: TeamMember[];
    eliminatedAt: Date | null;
    logo?: string | null;
  }): Team {
    const team = new Team(props.id, props.name, props.members, props.logo ?? null);
    team.eliminatedAt = props.eliminatedAt;
    return team;
  }
}
