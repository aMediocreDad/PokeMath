-- Logins without email: a teacher gives each child a code. The code itself is never stored, only
-- its SHA-256, so the teacher page can show a code once and make a new one, not look it up.
CREATE TABLE kids (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code_hash TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Who a browser is logged in as. subject is the email for an email login and 'kid:<id>' for a
-- code login; saves.email holds the same subject, so each child has a save of their own.
CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  exp INTEGER NOT NULL
);
CREATE INDEX sessions_subject ON sessions (subject);

-- Wrong codes per network address, to slow down guessing.
CREATE TABLE login_failures (
  ip TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);
