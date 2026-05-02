#!/usr/bin/env bash
# @file test-money-down.sh
# @description Tears down the test dev server and stripe listen spawned by
#   test-money-up.sh. Leaves the test Supabase running (use `npm run test:db:down`
#   to stop that).
#   Called by: humans, or test runners on shutdown
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

for pidfile in .stripe-listen.pid .test-dev.pid; do
  if [[ -f "$pidfile" ]]; then
    PID="$(cat "$pidfile" || true)"
    if [[ -n "$PID" ]] && kill -0 "$PID" 2>/dev/null; then
      echo "Killing $pidfile (PID $PID)"
      kill "$PID" 2>/dev/null || true
    fi
    rm -f "$pidfile"
  fi
done
rm -f .stripe-whsec .stripe-listen.log .test-dev.log
echo "Done. Test Supabase still running. Stop it with: npm run test:db:down"
