import { QualifyingRoundRepository } from '../../../application/ports/qualifying-round.repository';
import { EntityId } from '../../../domain/value-objects/entity-id';
import { QualifyingRound } from '../../../domain/entities/qualifying-round';
import { TournamentDatabase } from './database';
import { SqliteTeamRepository } from './team.repository';
import { BusinessCaseMapper, BusinessCaseRow } from './mappers/business-case.mapper';
import { SubmissionMapper, SubmissionRow } from './mappers/submission.mapper';

interface QualifyingRoundRow {
  id: string;
  tournament_id: string;
  business_case_id: string;
  timer_duration_seconds: number;
}

export class SqliteQualifyingRoundRepository implements QualifyingRoundRepository {
  constructor(
    private readonly db: TournamentDatabase,
    private readonly teamRepository: SqliteTeamRepository,
  ) {}

  async save(round: QualifyingRound, tournamentId: EntityId): Promise<void> {
    this.upsertBusinessCaseRow(round);

    this.db.connection
      .prepare(
        `INSERT INTO qualifying_rounds (id, tournament_id, business_case_id, timer_duration_seconds)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           business_case_id = excluded.business_case_id,
           timer_duration_seconds = excluded.timer_duration_seconds`,
      )
      .run(
        round.getId().toString(),
        tournamentId.toString(),
        round.getBusinessCase().getId().toString(),
        round.getTimerDurationSeconds(),
      );

    this.db.connection
      .prepare('DELETE FROM qualifying_round_participants WHERE qualifying_round_id = ?')
      .run(round.getId().toString());
    for (const teamId of round.getParticipantTeamIds()) {
      this.db.connection
        .prepare(
          'INSERT INTO qualifying_round_participants (qualifying_round_id, team_id) VALUES (?, ?)',
        )
        .run(round.getId().toString(), teamId);
    }

    this.db.connection
      .prepare('DELETE FROM qualifying_submissions WHERE qualifying_round_id = ?')
      .run(round.getId().toString());
    for (const submission of round.getSubmissions()) {
      const row = SubmissionMapper.toRow(submission, round.getId()); // match_id reutilizado como qualifying_round_id
      this.db.connection
        .prepare(
          `INSERT INTO qualifying_submissions
             (id, qualifying_round_id, team_id, content, submitted_at, verdict, judged_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(row.id, row.match_id, row.team_id, row.content, row.submitted_at, row.verdict, row.judged_at);
    }
  }

  async findByTournamentId(tournamentId: EntityId): Promise<QualifyingRound | null> {
    const row = this.db.connection
      .prepare('SELECT * FROM qualifying_rounds WHERE tournament_id = ?')
      .get(tournamentId.toString()) as unknown as QualifyingRoundRow | undefined;

    if (!row) return null;

    const businessCaseRow = this.db.connection
      .prepare('SELECT * FROM business_cases WHERE id = ?')
      .get(row.business_case_id) as unknown as BusinessCaseRow;
    const businessCase = BusinessCaseMapper.toDomain(businessCaseRow);

    const participantRows = this.db.connection
      .prepare('SELECT team_id FROM qualifying_round_participants WHERE qualifying_round_id = ?')
      .all(row.id) as unknown as Array<{ team_id: string }>;
    const teamIds = participantRows.map((p) => EntityId.fromString(p.team_id));
    const teams = await this.teamRepository.findByIds(teamIds);

    const submissionRows = this.db.connection
      .prepare('SELECT * FROM qualifying_submissions WHERE qualifying_round_id = ?')
      .all(row.id) as unknown as SubmissionRow[];
    const submissions = submissionRows.map(SubmissionMapper.toDomain);

    return QualifyingRound.rehydrate({
      id: EntityId.fromString(row.id),
      teams,
      businessCase,
      timerDurationSeconds: row.timer_duration_seconds,
      submissions,
    });
  }

  private upsertBusinessCaseRow(round: QualifyingRound): void {
    const row = BusinessCaseMapper.toRow(round.getBusinessCase());
    this.db.connection
      .prepare(
        `INSERT INTO business_cases (id, title, description, structure_type)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO NOTHING`,
      )
      .run(row.id, row.title, row.description, row.structure_type);
  }
}
