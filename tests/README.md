# Browser checks

Plain Node scripts that drive WebKit through `playwright-core`. They expect the site on
`http://localhost:3123`, which `tests/serve-build.sh` builds and serves with the mock server.

`playwright-core` is pinned to the version whose WebKit build is already installed locally;
`npx playwright-core install webkit` fetches it on a new machine.

- `smoke.js <base>`: the server's HTTP endpoints and a full bingo round, no browser.
- `bingo-live-check.mjs [outdir]`: board size, kick, rename and continue, with screenshots.
- `*-shots.mjs`, `touch-audit.mjs`, `header-touch.mjs`, `answer-field.mjs`: screenshots and
  touch checks per page.
- `parity/`: compare a Svelte page with its legacy HTML page (`<name>-legacy.html`, which
  `serve-build.sh` copies from 23f7bb5). The legacy pages predate the live-site sync, so the
  game, profile and bingo pages now differ from them on purpose.

Size the run to the change: one page's script for a page, everything before a push.
