#!/bin/bash
# Inside a pod container: forward the Worker's port, then run each named browser check against it.
# Usage: bash tests/pod-run.sh <port>[:<mac port>] <script> [script...]
port=$1; shift
node tests/pod-forward.mjs "$port" &
sleep 1
for t in "$@"; do
	BASE=http://localhost:${port%%:*} node "tests/$t" > "/tmp/$t.log" 2>&1
	echo "$t exit $? pass $(grep -c PASS "/tmp/$t.log") fail $(grep -c FAIL "/tmp/$t.log")"
	grep -E 'FAIL|Error' "/tmp/$t.log" | head -5
done
