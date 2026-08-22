#!/usr/bin/env bash
# One gate for everything that must be true before a PR leaves this machine.
# Runs every check even after one fails, so a single run reports every problem.
# Usage: scripts/factory-check.sh [diff-base]   (default: origin/main...HEAD)
set -uo pipefail

BASE="${1:-origin/main}"
RANGE="${BASE}...HEAD"
SELF="scripts/factory-check.sh"
failed=0

fail() { printf '\033[31mFAIL\033[0m  %s\n' "$1"; failed=1; }
pass() { printf '\033[32mok\033[0m    %s\n' "$1"; }

run() { # run <label> <command...>
  local label="$1"; shift
  if "$@" >/tmp/factory-check.$$ 2>&1; then
    pass "$label"
  else
    fail "$label — rerun: $*"
    tail -20 /tmp/factory-check.$$
  fi
  rm -f /tmp/factory-check.$$
}

git rev-parse --verify --quiet "$BASE" >/dev/null || {
  echo "unknown diff base: $BASE"; exit 2
}

run "type-check" npm run type-check
run "lint"       npm run lint
run "test"       npm test

# Process artifacts are local-only (git/info/exclude). They must never reach a PR.
artifacts=$(git diff --name-only "$RANGE" \
  | grep -E '^(\.claude|\.superpowers|docs/plans|docs/superpowers|graphify-out)/' || true)
if [ -n "$artifacts" ]; then
  fail "process artifacts in the diff:"
  echo "$artifacts" | sed 's/^/        /'
else
  pass "no process artifacts in the diff"
fi

# Secret-shaped ADDED lines only (+), excluding this script so its own patterns
# do not trip the gate when it is the file being added.
# ponytail: pattern match, not entropy. Add a real scanner only if this misses one.
secrets=$(git diff "$RANGE" -- . ":(exclude)$SELF" \
  | grep -E '^\+' \
  | grep -EI '(MONGODB_URI|API_KEY|SECRET_KEY|_SECRET|ACCESS_TOKEN)[[:space:]]*[=:][[:space:]]*[^[:space:]"'"'"']|mongodb(\+srv)?://[^[:space:]]*:[^[:space:]]*@|BEGIN [A-Z ]*PRIVATE KEY' \
  || true)
if [ -n "$secrets" ]; then
  fail "secret-shaped lines added:"
  echo "$secrets" | sed 's/^/        /'
else
  pass "no secret-shaped lines added"
fi

echo
if [ "$failed" -eq 0 ]; then
  echo "factory-check: PASS ($RANGE)"
else
  echo "factory-check: FAIL ($RANGE)"
fi
exit "$failed"
