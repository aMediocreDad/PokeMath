-- Players: the id the browser made up, the token the server handed back, and the last stats upload.
CREATE TABLE users (
  uuid TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  stats TEXT,
  updated_at INTEGER
);

-- Event counters, such as the spring event's catch total.
CREATE TABLE counters (
  name TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE event_milestones (
  event TEXT NOT NULL,
  segment INTEGER NOT NULL,
  reached_at TEXT NOT NULL,
  PRIMARY KEY (event, segment)
);

-- Codes for redeem.html. value is JSON, because built-in codes hold numbers and teacher codes text.
CREATE TABLE codes (
  code TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  value TEXT,
  label TEXT NOT NULL,
  image TEXT,
  repeatable INTEGER NOT NULL DEFAULT 0,
  teacher_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE teachers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  county TEXT NOT NULL DEFAULT '',
  municipality TEXT NOT NULL DEFAULT '',
  school_name TEXT NOT NULL DEFAULT '',
  how_found TEXT NOT NULL DEFAULT '',
  email_verified INTEGER NOT NULL DEFAULT 0,
  code_tokens INTEGER NOT NULL DEFAULT 10
);

CREATE TABLE teacher_sessions (
  token TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  exp INTEGER NOT NULL
);

-- One-time links: kind is 'verify' or 'reset'.
CREATE TABLE teacher_tokens (
  token TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  exp INTEGER NOT NULL
);
