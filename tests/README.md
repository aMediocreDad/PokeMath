# Browser checks

Plain Node scripts that drive WebKit through `playwright-core`. They expect the site on
`http://localhost:3123`, which `tests/serve-worker.sh` (`npm run dev:worker`) builds and serves
with the Cloudflare Worker and a fresh local database. `MIRROR_ONLY=1` turns off the live-site
image fallback. `tests/serve-build.sh` serves the old in-memory mock in `dev/` instead.

`playwright-core` is pinned to the version whose WebKit build is already installed locally;
`npx playwright-core install webkit` fetches it on a new machine.

- `smoke.js <base>`: the Worker's HTTP endpoints and a full bingo round, no browser. The local
  Worker treats every request as `laerer@test.no`, a teacher; an `x-dev-email` header makes it
  someone else. The old mock in `dev/` still expects password logins and fails the teacher part.
- `bingo-live-check.mjs [outdir]`: board size, kick, rename and continue, with screenshots.
- `asset-404s.mjs`: opens the main pages and lists every file that fails to load.
- `*-shots.mjs`, `touch-audit.mjs`, `header-touch.mjs`, `answer-field.mjs`: screenshots and
  touch checks per page. Stale since the redesign, against the mock as much as the Worker:
  `header-touch` and `game-shots` look for selectors that were renamed, and `touch-audit`'s
  clock fails on this playwright-core.
- `parity/`: compare a Svelte page with its legacy HTML page (`<name>-legacy.html`, which
  `serve-build.sh` copies from 23f7bb5). The legacy pages predate the live-site sync, so the
  game, profile and bingo pages now differ from them on purpose.

Size the run to the change: one page's script for a page, everything before a push.
