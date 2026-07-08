-- Esquema del torneo. Todas las fechas se guardan como TEXT en formato
-- ISO 8601 (compatible con `new Date(str)` de JS). Los ids son TEXT (UUID).

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  members_json TEXT NOT NULL,
  eliminated_at TEXT,
  logo TEXT,
  code TEXT
);

CREATE TABLE IF NOT EXISTS business_cases (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  structure_type TEXT NOT NULL,
  test_cases_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS tournaments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  pending_case_ids TEXT NOT NULL DEFAULT '[]',
  language TEXT NOT NULL DEFAULT 'PSEINT'
);

CREATE TABLE IF NOT EXISTS rounds (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  round_order INTEGER NOT NULL,
  UNIQUE (tournament_id, round_order)
);

CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  round_name TEXT NOT NULL,
  team_a_id TEXT NOT NULL REFERENCES teams(id),
  team_b_id TEXT NOT NULL REFERENCES teams(id),
  business_case_id TEXT NOT NULL REFERENCES business_cases(id),
  timer_duration_seconds INTEGER NOT NULL,
  status TEXT NOT NULL,
  timer_started_at TEXT,
  winner_id TEXT,
  resolution TEXT
);

CREATE TABLE IF NOT EXISTS match_disqualifications (
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL,
  PRIMARY KEY (match_id, team_id)
);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL,
  content TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  verdict TEXT NOT NULL,
  judged_at TEXT,
  execution_result_json TEXT
);

CREATE TABLE IF NOT EXISTS qualifying_rounds (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL UNIQUE REFERENCES tournaments(id) ON DELETE CASCADE,
  business_case_id TEXT NOT NULL REFERENCES business_cases(id),
  timer_duration_seconds INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS qualifying_round_participants (
  qualifying_round_id TEXT NOT NULL REFERENCES qualifying_rounds(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL,
  PRIMARY KEY (qualifying_round_id, team_id)
);

CREATE TABLE IF NOT EXISTS qualifying_submissions (
  id TEXT PRIMARY KEY,
  qualifying_round_id TEXT NOT NULL REFERENCES qualifying_rounds(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL,
  content TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  verdict TEXT NOT NULL,
  judged_at TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
