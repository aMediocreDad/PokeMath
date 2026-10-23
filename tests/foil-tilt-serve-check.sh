#!/bin/bash
# Build this checkout, serve it statically on :3126 and run tests/foil-tilt-check.mjs.
# Usage: tests/foil-tilt-serve-check.sh [outdir]
set -e
cd "$(dirname "$0")/.."
npm run build > /dev/null
python3 -m http.server 3126 --directory build > /dev/null 2>&1 &
trap 'kill $!' EXIT
sleep 1
node tests/foil-tilt-check.mjs http://localhost:3126 "$@"
