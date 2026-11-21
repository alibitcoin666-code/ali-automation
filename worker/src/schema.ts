// Generated from migrations/0001_init.sql (comments stripped). Applied by the Store Durable Object.
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  chat_id INTEGER NOT NULL,
  channel TEXT NOT NULL,
  type TEXT NOT NULL,
  format TEXT NOT NULL,
  topic TEXT NOT NULL,
  status TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'guard',
  request_json TEXT NOT NULL,
  script_hash TEXT,
  edit_note TEXT,
  error TEXT,
  day TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS jobs_day ON jobs(day);
CREATE INDEX IF NOT EXISTS jobs_updated ON jobs(updated_at DESC);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL,
  at INTEGER NOT NULL,
  stage TEXT NOT NULL,
  status TEXT NOT NULL,
  data TEXT
);
CREATE INDEX IF NOT EXISTS events_job ON events(job_id, at);
CREATE TABLE IF NOT EXISTS drafts (
  chat_id INTEGER PRIMARY KEY,
  state TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS magic (
  token_hash TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);
`;
