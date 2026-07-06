import { EntityId } from '../../../../domain/value-objects/entity-id';
import { Submission, VerdictStatus } from '../../../../domain/entities/submission';

export interface SubmissionRow {
  id: string;
  match_id: string;
  team_id: string;
  content: string;
  submitted_at: string;
  verdict: string;
  judged_at: string | null;
}

export class SubmissionMapper {
  static toDomain(row: SubmissionRow): Submission {
    return Submission.rehydrate({
      id: EntityId.fromString(row.id),
      teamId: EntityId.fromString(row.team_id),
      content: row.content,
      submittedAt: new Date(row.submitted_at),
      verdict: row.verdict as VerdictStatus,
      judgedAt: row.judged_at ? new Date(row.judged_at) : null,
    });
  }

  static toRow(submission: Submission, matchId: EntityId): SubmissionRow {
    return {
      id: submission.getId().toString(),
      match_id: matchId.toString(),
      team_id: submission.getTeamId().toString(),
      content: submission.getContent(),
      submitted_at: submission.getSubmittedAt().toISOString(),
      verdict: submission.getVerdict(),
      judged_at: submission.getJudgedAt()?.toISOString() ?? null,
    };
  }
}
