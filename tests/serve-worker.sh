#!/bin/bash
# Build, then run the Worker locally on :3123 with a fresh database seeded like dev/ was.
# Images and fonts that are not mirrored yet come from the live site, unless MIRROR_ONLY is set.
# Pass --keep to reuse the database from the last run instead of starting over.
set -e
cd "$(dirname "$0")/.."
STATE="${TMPDIR:-/tmp}/pokemath-wrangler"
export WRANGLER_LOG_PATH="$STATE/logs"
# Local runs keep Wrangler's own settings out of the home folder; they need no Cloudflare login.
export XDG_CONFIG_HOME="$STATE/config" WRANGLER_SEND_METRICS=false
[ "$1" = "--keep" ] || rm -rf "$STATE/state"
npm run build > "$STATE.build.log" 2>&1 || { tail -30 "$STATE.build.log"; exit 1; }
if [ "$1" != "--keep" ]; then
	npx wrangler d1 migrations apply DB --local --persist-to "$STATE/state" > /dev/null
	npx wrangler d1 execute DB --local --persist-to "$STATE/state" --file worker/seed-local.sql > /dev/null
fi
echo "build ok"
ORIGIN=(--var ASSET_ORIGIN:https://pokemath.online)
[ -n "$MIRROR_ONLY" ] && ORIGIN=()
exec npx wrangler dev --port 3123 --persist-to "$STATE/state" --var ACCESS_DISABLED:true --var BINGO_JURISDICTION: "${ORIGIN[@]}"
