-- One cloud save per Access login. data is the save as a JSON object of localStorage keys and
-- values; pokemon is how many Pokémon it holds, so the Worker can refuse to shrink it by accident.
CREATE TABLE saves (
  email TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  pokemon INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
