#!/usr/bin/env bash
# @file test-money-up.sh
# @description Preflight for live-money tests. Validates the Stripe CLI is installed
#   and STRIPE_SECRET_KEY is test-mode, asserts the test Supabase is up, spawns a
#   test-mode Next.js dev server on $TEST_NEXT_PORT pointed at the test Supabase,
#   then starts `stripe listen` forwarding to that server. Captures both PIDs and
#   the printed whsec_ for cleanup. Re-runnable: kills any prior PIDs first.
#   Called by: humans before `npx playwright test --project=live-money` or live-money runs in playwright webServer.
#
# Usage:
#   eval $(bash scripts/test-money-up.sh)   # capture exported STRIPE_WEBHOOK_SECRET into shell
#   # ... run tests ...
#   bash scripts/test-money-down.sh         # tear down
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

err() { echo "ERR: $*" >&2; exit 1; }
log() { echo "# $*" >&2; }

# 1. Required tools
command -v stripe >/dev/null || err "Stripe CLI not installed. Install: brew install stripe/stripe-cli/stripe"
command -v curl   >/dev/null || err "curl not installed."
command -v node   >/dev/null || err "node not installed."

# 2. Load .env.test (TEST_SUPABASE_*, TEST_NEXT_PORT)
[[ -f .env.test ]] || err ".env.test not found. Copy .env.test.example and fill in values from \`npx supabase status --workdir supabase-test\`."
set -a
# shellcheck disable=SC1091
source .env.test
set +a

# 3. Load STRIPE_SECRET_KEY from .env.local if not already in env
if [[ -z "${STRIPE_SECRET_KEY:-}" ]] && [[ -f .env.local ]]; then
  STRIPE_LINE="$(grep -E '^STRIPE_SECRET_KEY=' .env.local | head -1 || true)"
  if [[ -n "$STRIPE_LINE" ]]; then
    export "${STRIPE_LINE?}"
  fi
fi
[[ -n "${STRIPE_SECRET_KEY:-}" ]] || err "STRIPE_SECRET_KEY not set in env or .env.local."
[[ "${STRIPE_SECRET_KEY}" == sk_test_* ]] || err "STRIPE_SECRET_KEY must be a test-mode key (sk_test_*). Refusing to forward live webhooks to a test server."

# 4. Required test env vars
: "${TEST_SUPABASE_URL:?TEST_SUPABASE_URL missing from .env.test}"
: "${TEST_SUPABASE_PUBLISHABLE_DEFAULT_KEY:?TEST_SUPABASE_PUBLISHABLE_DEFAULT_KEY missing}"
: "${TEST_SUPABASE_SECRET_KEY:?TEST_SUPABASE_SECRET_KEY missing}"
TEST_NEXT_PORT="${TEST_NEXT_PORT:-3100}"

# 5. Assert test Supabase is reachable
if ! curl -fs -m 3 "${TEST_SUPABASE_URL}/auth/v1/health" >/dev/null 2>&1; then
  err "Test Supabase not reachable at ${TEST_SUPABASE_URL}. Start it with: npm run test:db:up"
fi

log "USING TEST DB at ${TEST_SUPABASE_URL} (Next on :${TEST_NEXT_PORT})"

# 6. Kill any previous run's PIDs
for pidfile in .stripe-listen.pid .test-dev.pid; do
  if [[ -f "$pidfile" ]]; then
    OLD_PID="$(cat "$pidfile" || true)"
    if [[ -n "$OLD_PID" ]] && kill -0 "$OLD_PID" 2>/dev/null; then
      log "Killing prior $pidfile (PID $OLD_PID)"
      kill "$OLD_PID" 2>/dev/null || true
    fi
    rm -f "$pidfile"
  fi
done
rm -f .stripe-whsec .test-dev.log

# 7. Spawn the test-mode Next.js dev server
log "Spawning test dev server on :${TEST_NEXT_PORT}..."
PORT="${TEST_NEXT_PORT}" \
NEXT_PUBLIC_SUPABASE_URL="${TEST_SUPABASE_URL}" \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY="${TEST_SUPABASE_PUBLISHABLE_DEFAULT_KEY}" \
SUPABASE_SECRET_KEY="${TEST_SUPABASE_SECRET_KEY}" \
STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY}" \
nohup npm run dev > .test-dev.log 2>&1 &
echo $! > .test-dev.pid

# Wait up to 30s for the dev server to respond
for i in $(seq 1 60); do
  if curl -fs -m 1 "http://127.0.0.1:${TEST_NEXT_PORT}" >/dev/null 2>&1; then
    log "Dev server up after ${i}s"
    break
  fi
  if [[ "$i" == "60" ]]; then
    err "Test dev server never came up on :${TEST_NEXT_PORT} within 30s. See .test-dev.log"
  fi
  sleep 0.5
done

# 8. Spawn `stripe listen` — pass --api-key explicitly so it forwards events
# from the test account in .env.local (NOT the CLI's default account, which may
# be a different Stripe account entirely). Do NOT use --print-secret (that flag
# makes stripe listen print the secret and exit immediately, defeating the
# whole point of "listen").
log "Starting stripe listen forwarding to :${TEST_NEXT_PORT}/api/stripe/webhooks..."
nohup stripe listen \
  --api-key "${STRIPE_SECRET_KEY}" \
  --forward-to "http://127.0.0.1:${TEST_NEXT_PORT}/api/stripe/webhooks" \
  > .stripe-listen.log 2>&1 &
echo $! > .stripe-listen.pid

# Poll for the "whsec_" line in the long-running stdout (10s timeout)
WHSEC=""
for i in $(seq 1 100); do
  if [[ -f .stripe-listen.log ]]; then
    WHSEC="$(grep -oE 'whsec_[A-Za-z0-9]+' .stripe-listen.log | head -1 || true)"
    if [[ -n "$WHSEC" ]]; then
      break
    fi
  fi
  sleep 0.1
done
[[ -n "$WHSEC" ]] || err "stripe listen never printed whsec_ in 10s. Check .stripe-listen.log for errors."

# Confirm the listener didn't immediately die
if ! kill -0 "$(cat .stripe-listen.pid)" 2>/dev/null; then
  err "stripe listen process died immediately. See .stripe-listen.log"
fi
echo "$WHSEC" > .stripe-whsec

# 9. Restart the dev server with STRIPE_WEBHOOK_SECRET now that we have it
# (The webhook handler reads STRIPE_WEBHOOK_SECRET to verify signatures.)
log "Restarting dev server with STRIPE_WEBHOOK_SECRET=${WHSEC}..."
kill "$(cat .test-dev.pid)" 2>/dev/null || true
sleep 1
PORT="${TEST_NEXT_PORT}" \
NEXT_PUBLIC_SUPABASE_URL="${TEST_SUPABASE_URL}" \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY="${TEST_SUPABASE_PUBLISHABLE_DEFAULT_KEY}" \
SUPABASE_SECRET_KEY="${TEST_SUPABASE_SECRET_KEY}" \
STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY}" \
STRIPE_WEBHOOK_SECRET="${WHSEC}" \
nohup npm run dev > .test-dev.log 2>&1 &
echo $! > .test-dev.pid

for i in $(seq 1 60); do
  if curl -fs -m 1 "http://127.0.0.1:${TEST_NEXT_PORT}" >/dev/null 2>&1; then
    break
  fi
  if [[ "$i" == "60" ]]; then
    err "Test dev server failed to come back up after restart."
  fi
  sleep 0.5
done

log "Ready. Eval the line below in your shell to inherit STRIPE_WEBHOOK_SECRET:"
# Stdout = the export line for `eval $(bash scripts/test-money-up.sh)`
echo "export STRIPE_WEBHOOK_SECRET=${WHSEC} TEST_NEXT_PORT=${TEST_NEXT_PORT}"
log "When done: bash scripts/test-money-down.sh"
