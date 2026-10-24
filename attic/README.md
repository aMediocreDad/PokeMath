# Attic

Pages from the old site that nothing links to, kept out of `static/` so they are no longer served.
Each one works on its own and could become a feature of the app.

- `tekstoppgave.html`, `tekstoppgaver.js`, `tekstoppgaver.css`: a word-problem trainer. 112
  Norwegian story templates across five levels (Grønn up to 20, Gul 50, Rød 100, Svart 10 000,
  Hodeskalle millions), all four operations, answers with up to 4 decimals, comma or point. "Vis
  fasit" costs the point. It stores only a per-level counter (`oppg_teller_per_nivaa_v1`) and gives
  no coins or Pokémon. Its own note says the templates are AI-generated and the numbers can be
  illogical on the hard levels. As a feature: a "Tekstoppgaver" mode on the game page that pays
  like a stage.
- `speedrun.html`: a timed drill over 25 topics (tiervenner, hundrervenner, small and big times
  tables, addition and subtraction at five levels, multiplication by digit count, expanding and
  reducing fractions). 5 to 500 tasks in a grid, optional timer, score and time per task at the
  end. Nothing is stored. The app has no fractions, number bonds or timed sets yet.
- `bingo.html`, `bingo.css`, `bingo.js`: the first bingo. Its solo card works (24 tasks from
  `static/bingo-tasks.js` and a free centre, tapped to mark); its online host and join buttons
  are dead. It loaded the legacy `global.js` and stylesheets, which are gone, so it does not run
  as it is. As a feature: a "print or whiteboard card" on the teacher's bingo page.
