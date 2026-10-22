#!/bin/bash
# Build, add the legacy versions of migrated pages as <name>-legacy.html, and serve build/ on :3123.
set -e
cd "$(dirname "$0")/.."
npm run build > "$TMPDIR/build.log" 2>&1 || { tail -30 "$TMPDIR/build.log"; exit 1; }
grep -q 'Wrote site' "$TMPDIR/build.log"
for page in faq player_profile saveandload pokemath; do
	git show "23f7bb5:static/$page.html" > "build/$page-legacy.html"
done
echo "build ok"
SITE_DIR=build NODE_USE_ENV_PROXY=1 PORT=3123 exec node dev/server.js
