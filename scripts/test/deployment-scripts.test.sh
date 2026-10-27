#!/usr/bin/env bash
# Focused harness for generateDevEnv.sh and sync-deployment-config.sh
# (help / missing-file / diff dry-run). Run from the repo root:
#   bash scripts/test/deployment-scripts.test.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FAILS=0

assert_eq() {
  local expected="$1"
  local actual="$2"
  local label="$3"
  if [[ "$actual" != "$expected" ]]; then
    echo "FAIL: ${label} (expected ${expected}, got ${actual})" >&2
    FAILS=$((FAILS + 1))
  else
    echo "ok: ${label}"
  fi
}

assert_contains() {
  local haystack="$1"
  local needle="$2"
  local label="$3"
  if [[ "$haystack" != *"$needle"* ]]; then
    echo "FAIL: ${label} (missing '${needle}')" >&2
    FAILS=$((FAILS + 1))
  else
    echo "ok: ${label}"
  fi
}

# --- generateDevEnv.sh: missing core.json --------------------------------
GEN_DIR="$(mktemp -d)"
set +e
GEN_OUT="$(cd "$GEN_DIR" && bash "${ROOT_DIR}/scripts/generateDevEnv.sh" 2>&1)"
GEN_CODE=$?
set -e
assert_eq "1" "$GEN_CODE" "generateDevEnv.sh exits 1 when core.json is missing"
assert_contains "$GEN_OUT" "Config file not found" "generateDevEnv.sh reports missing config"

# --- sync-deployment-config.sh: help / missing env -----------------------
HELP_OUT="$("${ROOT_DIR}/scripts/sync-deployment-config.sh" --help)"
assert_contains "$HELP_OUT" "push|pull|diff" "sync --help prints usage"

set +e
MISSING_OUT="$("${ROOT_DIR}/scripts/sync-deployment-config.sh" diff 2>&1)"
MISSING_CODE=$?
set -e
assert_eq "1" "$MISSING_CODE" "sync diff without environment exits 1"
assert_contains "$MISSING_OUT" "Usage:" "sync diff without environment prints usage"

# --- sync-deployment-config.sh: diff dry-run -----------------------------
WORK="$(mktemp -d)"
trap 'rm -rf "$GEN_DIR" "$WORK"' EXIT

mkdir -p "${WORK}/repo/configs/harness"
git -C "${WORK}/repo" init -b main >/dev/null
printf '%s\n' '{"branding":{"appName":"Harness"}}' > "${WORK}/repo/configs/harness/core.json"
git -C "${WORK}/repo" add configs/harness/core.json
git -C "${WORK}/repo" -c user.name=test -c user.email=test@example.com commit -m 'seed' >/dev/null
git init --bare -b main "${WORK}/origin.git" >/dev/null
git -C "${WORK}/repo" remote add origin "${WORK}/origin.git"
git -C "${WORK}/repo" push -u origin main >/dev/null

mkdir -p "${WORK}/local/harness"
cp "${WORK}/repo/configs/harness/core.json" "${WORK}/local/harness/core.json"

CACHE="${WORK}/cache.json"
set +e
DIFF_SAME_OUT="$(
  FAIMS_CONFIG_REPO_CACHE="$CACHE" \
    "${ROOT_DIR}/scripts/sync-deployment-config.sh" diff harness \
    --repo-path "${WORK}/repo" \
    --local-root "${WORK}/local" \
    --config-path configs \
    --no-artifacts \
    --force 2>&1
)"
DIFF_SAME_CODE=$?
set -e
assert_eq "0" "$DIFF_SAME_CODE" "sync diff exits 0 when core.json matches"
assert_contains "$DIFF_SAME_OUT" "no changes pending" "sync diff reports no pending changes"

printf '%s\n' '{"branding":{"appName":"Changed"}}' > "${WORK}/local/harness/core.json"
set +e
DIFF_CHANGED_OUT="$(
  FAIMS_CONFIG_REPO_CACHE="$CACHE" \
    "${ROOT_DIR}/scripts/sync-deployment-config.sh" diff harness \
    --repo-path "${WORK}/repo" \
    --local-root "${WORK}/local" \
    --config-path configs \
    --no-artifacts \
    --force 2>&1
)"
DIFF_CHANGED_CODE=$?
set -e
assert_eq "1" "$DIFF_CHANGED_CODE" "sync diff exits 1 when core.json differs"
assert_contains "$DIFF_CHANGED_OUT" "CHANGED" "sync diff reports a changed core.json"

if [[ "$FAILS" -gt 0 ]]; then
  echo "${FAILS} assertion(s) failed" >&2
  exit 1
fi
echo "All deployment-script checks passed."
