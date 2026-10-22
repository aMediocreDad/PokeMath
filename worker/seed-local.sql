-- Local development data, the same as dev/ had in memory. Never applied to the deployed database.
-- The test teacher logs in with laerer@test.no / passord123.
INSERT INTO teachers (id, name, email, password_hash, email_verified)
VALUES ('test-teacher', 'Testlærer', 'laerer@test.no',
  'pbkdf2$20000$90839c05419f44b0d93cd50c75e81992$07e6f0a7e156d84f885317f0c1eb9dd584b7bd1c432c6285c0354530c12a7ff8', 1);

INSERT INTO codes (code, type, value, label, created_at) VALUES
  ('MYNTER', 'coins', '500', '500 mynter!', 0),
  ('SHINY', 'random_shiny', NULL, 'En tilfeldig shiny!', 0),
  ('LEGENDARISK', 'random_legendary', NULL, 'En legendarisk Pokémon!', 0),
  ('STJERNESTØV', 'stardust', '3', '3 stjernestøv!', 0),
  ('PIKACHU', 'pokemon', '"N25"', 'Pikachu!', 0);
