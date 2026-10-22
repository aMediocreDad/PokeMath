-- Local development data, the same as dev/ had in memory. Never applied to the deployed database.
-- The test teacher logs in with laerer@test.no / passord123.
INSERT INTO teachers (id, name, email, password_hash, email_verified)
VALUES ('test-teacher', 'Testlærer', 'laerer@test.no',
  'pbkdf2$100000$27e4638637eb582dc6d6942df1811ab1$45ab551bcc76d6fa63bb5e8f57687be0c4c0d30e5208a5b5a0ce19e2988783ee', 1);

INSERT INTO codes (code, type, value, label, created_at) VALUES
  ('MYNTER', 'coins', '500', '500 mynter!', 0),
  ('SHINY', 'random_shiny', NULL, 'En tilfeldig shiny!', 0),
  ('LEGENDARISK', 'random_legendary', NULL, 'En legendarisk Pokémon!', 0),
  ('STJERNESTØV', 'stardust', '3', '3 stjernestøv!', 0),
  ('PIKACHU', 'pokemon', '"N25"', 'Pikachu!', 0);
