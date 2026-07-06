import { EntityId } from '../../../../domain/value-objects/entity-id';
import { Match, MatchResolution } from '../../../../domain/entities/match';
import { MatchStatus } from '../../../../domain/services/match-state-machine';
import { BusinessCase } from '../../../../domain/entities/business-case';
import { Submission } from '../../../../domain/entities/submission';

export interface MatchRow {
  id: string;
  round_id: string;
  round_name: string;
  team_a_id: string;
  team_b_id: string;
  business_case_id: string;
  timer_duration_seconds: number;
  status: string;
  timer_started_at: string | null;
  winner_id: string | null;
  resolution: string | null;
}

export class MatchMapper {
  /**
   * businessCase, submissions y disqualifiedTeamIds ya deben venir resueltos
   * por el repositorio (que hace las consultas relacionadas) — este mapper
   * no consulta la BD, solo ensambla objetos de dominio (Single Responsibility).
   */
  static toDomain(
    row: MatchRow,
    businessCase: BusinessCase,
    submissions: Submission[],
    disqualifiedTeamIds: string[],
  ): Match {
    return Match.rehydrate({
      id: EntityId.fromString(row.id),
      roundName: row.round_name,
      teamAId: EntityId.fromString(row.team_a_id),
      teamBId: EntityId.fromString(row.team_b_id),
      businessCase,
      timerDurationSeconds: row.timer_duration_seconds,
      status: row.status as MatchStatus,
      timerStartedAt: row.timer_started_at ? new Date(row.timer_started_at) : null,
      submissions,
      disqualifiedTeamIds,
      winnerId: row.winner_id ? EntityId.fromString(row.winner_id) : null,
      resolution: row.resolution as MatchResolution | null,
    });
  }

  static toRow(match: Match, roundId: EntityId): MatchRow {
    return {
      id: match.getId().toString(),
      round_id: roundId.toString(),
      round_name: match.getRoundName(),
      team_a_id: match.getTeamAId().toString(),
      team_b_id: match.getTeamBId().toString(),
      business_case_id: match.getBusinessCase().getId().toString(),
      timer_duration_seconds: match.getTimerDurationSeconds(),
      status: match.getStatus(),
      timer_started_at: match.getTimerStartedAt()?.toISOString() ?? null,
      winner_id: match.getWinnerId()?.toString() ?? null,
      resolution: match.getResolution(),
    };
  }
}
