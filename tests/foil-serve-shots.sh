#!/bin/bash
# Build this checkout, serve it statically on :3124 and take the foil screenshots.
# Usage: tests/foil-serve-shots.sh [outdir]
set -e
cd "$(dirname "$0")/.."
npm run build > /dev/null
python3 -m http.server 3124 --directory build > /dev/null 2>&1 &
trap 'kill $!' EXIT
sleep 1
node tests/foil-shots.mjs http://localhost:3124 "$@"
