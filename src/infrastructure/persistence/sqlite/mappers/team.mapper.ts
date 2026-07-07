import { EntityId } from '../../../../domain/value-objects/entity-id';
import { TeamCode } from '../../../../domain/value-objects/team-code';
import { Team, TeamMember } from '../../../../domain/entities/team';

export interface TeamRow {
  id: string;
  name: string;
  members_json: string;
  eliminated_at: string | null;
  logo: string | null;
  code: string;
}

export class TeamMapper {
  static toDomain(row: TeamRow): Team {
    const members: TeamMember[] = JSON.parse(row.members_json);
    return Team.rehydrate({
      id: EntityId.fromString(row.id),
      name: row.name,
      members,
      code: TeamCode.fromString(row.code),
      eliminatedAt: row.eliminated_at ? new Date(row.eliminated_at) : null,
      logo: row.logo,
    });
  }

  static toRow(team: Team): TeamRow {
    return {
      id: team.getId().toString(),
      name: team.getName(),
      members_json: JSON.stringify(team.getMembers()),
      eliminated_at: team.getEliminatedAt()?.toISOString() ?? null,
      logo: team.getLogo(),
      code: team.getCode().toString(),
    };
  }
}
