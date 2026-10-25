#!/bin/bash
# The Worker behind `npm run dev` (vite.config.mjs starts it): the API, the login and the class games
# on :3001 (or $PORT), while vite serves the pages. The local database lives in .wrangler/dev and is
# kept between runs; delete that folder to start over. Images and fonts not mirrored into static/
# (npm run mirror) come from the live site. PAGE_HOST is the address the browser uses (vite's), so
# the Worker sees localhost and its local-only login shortcut applies.
set -e
cd "$(dirname "$0")/.."
PORT="${PORT:-3001}"
STATE=.wrangler/dev
# Wrangler's own settings stay in the project; local runs need no Cloudflare login.
export XDG_CONFIG_HOME="$PWD/.wrangler/config" WRANGLER_SEND_METRICS=false
npx wrangler d1 migrations apply DB --local --persist-to "$STATE" > /dev/null
if [ ! -f "$STATE/seeded" ]; then
	npx wrangler d1 execute DB --local --persist-to "$STATE" --file worker/seed-local.sql > /dev/null
	touch "$STATE/seeded"
fi
exec npx wrangler dev --port "$PORT" --local-upstream "${PAGE_HOST:-localhost:5173}" --assets static --persist-to "$STATE" \
	--var ACCESS_DISABLED:true --var BINGO_JURISDICTION: --var TEACHER_EMAILS:laerer@test.no --var ASSET_ORIGIN:https://pokemath.online
