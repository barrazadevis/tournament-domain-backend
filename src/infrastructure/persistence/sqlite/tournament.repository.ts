import { TournamentRepository } from '../../../application/ports/tournament.repository';
import { EntityId } from '../../../domain/value-objects/entity-id';
import { Tournament, TournamentStatus } from '../../../domain/entities/tournament';
import { Round } from '../../../domain/entities/round';
import { Match } from '../../../domain/entities/match';
import { BusinessCase } from '../../../domain/entities/business-case';
import { Submission } from '../../../domain/entities/submission';
import { TournamentDatabase } from './database';
import { MatchMapper, MatchRow } from './mappers/match.mapper';
import { SubmissionMapper, SubmissionRow } from './mappers/submission.mapper';
import { BusinessCaseMapper, BusinessCaseRow } from './mappers/business-case.mapper';

interface TournamentRow {
  id: string;
  name: string;
  status: string;
  pending_case_ids: string;
}

interface RoundRow {
  id: string;
  tournament_id: string;
  name: string;
  round_order: number;
}

/**
 * SqliteTournamentRepository: persiste y reconstruye el agregado Tournament
 * completo. Precondición: los Team referenciados por los matches (team_a_id,
 * team_b_id) ya deben existir en la tabla `teams` (guardados vía
 * TeamRepository) — esta clase no los crea, por Foreign Key.
 *
 * Estrategia de escritura (documentada como trade-off): en cada save(),
 * se borran y reinsertan las submissions/descalificaciones de cada match.
 * Es más simple que calcular un diff exacto, y perfectamente aceptable
 * para el volumen de esta app (una clase, ~20 equipos) — no lo haría así
 * en un sistema con miles de escrituras concurrentes.
 */
export class SqliteTournamentRepository implements TournamentRepository {
  constructor(private readonly db: TournamentDatabase) {}

  async save(tournament: Tournament): Promise<void> {
    this.upsertTournamentRow(tournament);

    for (const round of tournament.getRounds()) {
      this.upsertRoundRow(round, tournament.getId());

      for (const match of round.getMatches()) {
        this.upsertBusinessCaseRow(match.getBusinessCase());
        this.upsertMatchRow(match, round.getId());
        this.replaceSubmissions(match);
        this.replaceDisqualifications(match);
      }
    }
  }

  async findById(id: EntityId): Promise<Tournament | null> {
    const tournamentRow = this.db.connection
      .prepare('SELECT * FROM tournaments WHERE id = ?')
      .get(id.toString()) as unknown as TournamentRow | undefined;

    if (!tournamentRow) return null;

    const roundRows = this.db.connection
      .prepare('SELECT * FROM rounds WHERE tournament_id = ? ORDER BY round_order ASC')
      .all(id.toString()) as unknown as RoundRow[];

    const rounds = roundRows.map((roundRow) => this.loadRound(roundRow));

    const pendingCaseIds: string[] = JSON.parse(tournamentRow.pending_case_ids || '[]');

    return Tournament.rehydrate({
      id: EntityId.fromString(tournamentRow.id),
      name: tournamentRow.name,
      status: tournamentRow.status as TournamentStatus,
      rounds,
      pendingCaseIds: pendingCaseIds.map((id) => EntityId.fromString(id)),
    });
  }

  async findAll(): Promise<Tournament[]> {
    const rows = this.db.connection
      .prepare('SELECT id FROM tournaments')
      .all() as unknown as Array<{ id: string }>;

    const tournaments: Tournament[] = [];
    for (const row of rows) {
      const tournament = await this.findById(EntityId.fromString(row.id));
      if (tournament) tournaments.push(tournament);
    }
    return tournaments;
  }

  async delete(id: EntityId): Promise<void> {
    // rounds -> matches -> submissions/disqualificaciones y
    // qualifying_rounds -> participantes/submissions caen en cascada
    // (ver ON DELETE CASCADE en schema.sql) al borrar el torneo.
    this.db.connection.prepare('DELETE FROM tournaments WHERE id = ?').run(id.toString());
  }

  async reset(id: EntityId): Promise<void> {
    this.db.connection.prepare('DELETE FROM rounds WHERE tournament_id = ?').run(id.toString());
    this.db.connection.prepare('DELETE FROM qualifying_rounds WHERE tournament_id = ?').run(id.toString());
    this.db.connection
      .prepare("UPDATE tournaments SET status = ?, pending_case_ids = '[]' WHERE id = ?")
      .run(TournamentStatus.DRAFT, id.toString());
  }

  async findByMatchId(matchId: EntityId): Promise<Tournament | null> {
    const row = this.db.connection
      .prepare(
        `SELECT t.id AS tournament_id
         FROM matches m
         JOIN rounds r ON r.id = m.round_id
         JOIN tournaments t ON t.id = r.tournament_id
         WHERE m.id = ?`,
      )
      .get(matchId.toString()) as unknown as { tournament_id: string } | undefined;

    if (!row) return null;
    return this.findById(EntityId.fromString(row.tournament_id));
  }

  private loadRound(roundRow: RoundRow): Round {
    const round = new Round(EntityId.fromString(roundRow.id), roundRow.name, roundRow.round_order);

    const matchRows = this.db.connection
      .prepare('SELECT * FROM matches WHERE round_id = ? ORDER BY rowid ASC')
      .all(roundRow.id) as unknown as MatchRow[];

    for (const matchRow of matchRows) {
      round.addMatch(this.loadMatch(matchRow));
    }

    return round;
  }

  private loadMatch(matchRow: MatchRow): Match {
    const businessCaseRow = this.db.connection
      .prepare('SELECT * FROM business_cases WHERE id = ?')
      .get(matchRow.business_case_id) as unknown as BusinessCaseRow;
    const businessCase = BusinessCaseMapper.toDomain(businessCaseRow);

    const submissionRows = this.db.connection
      .prepare('SELECT * FROM submissions WHERE match_id = ? ORDER BY submitted_at ASC')
      .all(matchRow.id) as unknown as SubmissionRow[];
    const submissions = submissionRows.map(SubmissionMapper.toDomain);

    const disqualificationRows = this.db.connection
      .prepare('SELECT team_id FROM match_disqualifications WHERE match_id = ?')
      .all(matchRow.id) as unknown as Array<{ team_id: string }>;
    const disqualifiedTeamIds = disqualificationRows.map((r) => r.team_id);

    return MatchMapper.toDomain(matchRow, businessCase, submissions, disqualifiedTeamIds);
  }

  private upsertTournamentRow(tournament: Tournament): void {
    const pendingCaseIdsJson = JSON.stringify(tournament.getPendingCaseIds().map((id) => id.toString()));
    this.db.connection
      .prepare(
        `INSERT INTO tournaments (id, name, status, pending_case_ids)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           status = excluded.status,
           pending_case_ids = excluded.pending_case_ids`,
      )
      .run(tournament.getId().toString(), tournament.getName(), tournament.getStatus(), pendingCaseIdsJson);
  }

  private upsertRoundRow(round: Round, tournamentId: EntityId): void {
    this.db.connection
      .prepare(
        `INSERT INTO rounds (id, tournament_id, name, round_order)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, round_order = excluded.round_order`,
      )
      .run(round.getId().toString(), tournamentId.toString(), round.getName(), round.getOrder());
  }

  private upsertBusinessCaseRow(businessCase: BusinessCase): void {
    const row = BusinessCaseMapper.toRow(businessCase);
    this.db.connection
      .prepare(
        `INSERT INTO business_cases (id, title, description, structure_type)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO NOTHING`,
      )
      .run(row.id, row.title, row.description, row.structure_type);
  }

  private upsertMatchRow(match: Match, roundId: EntityId): void {
    const row = MatchMapper.toRow(match, roundId);
    this.db.connection
      .prepare(
        `INSERT INTO matches
           (id, round_id, round_name, team_a_id, team_b_id, business_case_id,
            timer_duration_seconds, status, timer_started_at, winner_id, resolution)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           status = excluded.status,
           timer_started_at = excluded.timer_started_at,
           winner_id = excluded.winner_id,
           resolution = excluded.resolution`,
      )
      .run(
        row.id,
        row.round_id,
        row.round_name,
        row.team_a_id,
        row.team_b_id,
        row.business_case_id,
        row.timer_duration_seconds,
        row.status,
        row.timer_started_at,
        row.winner_id,
        row.resolution,
      );
  }

  private replaceSubmissions(match: Match): void {
    this.db.connection
      .prepare('DELETE FROM submissions WHERE match_id = ?')
      .run(match.getId().toString());

    for (const submission of match.getSubmissions()) {
      const row = SubmissionMapper.toRow(submission, match.getId());
      this.db.connection
        .prepare(
          `INSERT INTO submissions (id, match_id, team_id, content, submitted_at, verdict, judged_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(row.id, row.match_id, row.team_id, row.content, row.submitted_at, row.verdict, row.judged_at);
    }
  }

  private replaceDisqualifications(match: Match): void {
    this.db.connection
      .prepare('DELETE FROM match_disqualifications WHERE match_id = ?')
      .run(match.getId().toString());

    for (const teamId of match.getDisqualifiedTeamIds()) {
      this.db.connection
        .prepare('INSERT INTO match_disqualifications (match_id, team_id) VALUES (?, ?)')
        .run(match.getId().toString(), teamId);
    }
  }
}
