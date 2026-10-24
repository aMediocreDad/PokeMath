-- Codes redeemed per login (saves.email's id: an email, or 'kid:<id>'), so a code that is not
-- repeatable pays each login once. The id is the same one saves are kept under.
CREATE TABLE redemptions (
  login_id TEXT NOT NULL,
  code TEXT NOT NULL,
  at INTEGER NOT NULL,
  PRIMARY KEY (login_id, code)
);
