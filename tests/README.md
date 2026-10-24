# Browser checks

Plain Node scripts that drive WebKit through `playwright-core`. They expect the site on
`http://localhost:3123`, which `tests/serve-worker.sh` (`npm run dev:worker`) builds and serves
with the Cloudflare Worker and a fresh local database. `MIRROR_ONLY=1` turns off the live-site
image fallback. `PORT=3125` serves on another port, for a second checkout running beside the
first; the class game checks then take `BASE=http://localhost:3125`. `tests/serve-build.sh`
serves the old in-memory mock in `dev/` instead.

`playwright-core` is pinned to the version whose WebKit build is already installed locally;
`npx playwright-core install webkit` fetches it on a new machine.

- `smoke.js <base>`: the Worker's HTTP endpoints, a full bingo round, a raid, a memory game and
  the login gate, no browser. On localhost the Worker treats a request without a session as `laerer@test.no`, a
  teacher; an `x-dev-email` header makes it someone else, and `x-dev-anonymous` makes it logged
  out. Run it last: its lockout check blocks code logins from this machine for 15 minutes. The
  old mock in `dev/` still expects password logins and fails the teacher part.
- `bingo-live-check.mjs [outdir]`: board size, kick, rename and continue, with screenshots.
- `raid-check.mjs [outdir]`, `memory-check.mjs [outdir]`: a whole raid or memory game, from
  the teacher's setup to the children's prizes, with screenshots.
- `memory-rules.mjs`: memory's turns and flips in `worker/memory.js`, without a server.
- `cloud-save-check.mjs`: two devices on one login, and two children on one iPad; progress
  moves over, and an empty, smaller or someone else's save never replaces one without a choice.
- `dialog-shots.mjs [outdir]`: the backup reminder, an in-page question and the import
  message fit a 320 px phone, an iPhone and a desktop, and no native dialog opens. Checks that
  only need to get past a question answer yes with `acceptAsks` from `ask.mjs`.
- `foil-card-shots.mjs [base] [outdir]`, `rarity-holo-shots.mjs [base] [outdir]`: the shiny foil, the
  trading card, and the legendary and mythic holo, against a static build
  (`python3 -m http.server 3124 --directory build`). The second also checks that the holo
  stands still until the mouse moves it.
- `asset-404s.mjs`: opens the main pages and lists every file that fails to load.
- `*-shots.mjs`, `touch-audit.mjs`, `header-touch.mjs`, `answer-field.mjs`: screenshots and
  touch checks per page. Stale since the redesign, against the mock as much as the Worker:
  `header-touch` and `game-shots` look for selectors that were renamed, and `touch-audit`'s
  clock fails on this playwright-core.
- `parity/`: compare a Svelte page with its legacy HTML page (`<name>-legacy.html`, which
  `serve-build.sh` copies from 23f7bb5). The legacy pages predate the live-site sync, so the
  game, profile and bingo pages now differ from them on purpose.

Size the run to the change: one page's script for a page, everything before a push.
