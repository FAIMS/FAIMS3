#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<EOF
Usage:
  $0 <environment> <local_secrets_file> [options]

Options:
  --repo-path <path>      Path to an already-cloned private config/match repo
  --config_repo <url>     Git URL of private config/match repo (used if --repo-path is not provided)
  --branch <name>         Branch to update (default: main)
  --message <text>        Commit message (default: update mobile secrets for <environment>)
  --target <path>         Target encrypted file path in repo
                          (default: mobile/<environment>/build-secrets.enc.json)
  --force                 Overwrite target file without prompt
  --help                  Show this help text

Behaviour:
  - Validates the local JSON file.
  - Decrypts existing encrypted file if present, merges existing + local JSON.
  - Re-encrypts with sops and commits/pushes to the chosen branch.

Notes:
  - Requires: git, jq, sops
  - SOPS key discovery is handled by sops itself. Typical options:
      * SOPS_AGE_KEY (private key content)
      * SOPS_AGE_KEY_FILE (path to private key file)
      * Default local age key locations
  - Keep private keys out of command arguments and repository files.
  - The script never prints secret values.
EOF
}

confirm_action() {
  local prompt="$1"
  read -r -p "$prompt (y/N): " choice
  case "$choice" in
    y|Y) return 0 ;;
    *) return 1 ;;
  esac
}

require_tool() {
  local tool="$1"
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Error: required tool '$tool' is not installed or not in PATH." >&2
    exit 1
  fi
}

sops_key_help() {
  cat >&2 <<EOF
SOPS could not decrypt the target file.

Make sure your decryption key is available to sops, for example via:
  - SOPS_AGE_KEY
  - SOPS_AGE_KEY_FILE
  - a default local age key file

In CI, provide the private key through a bootstrap secret and export it as
SOPS_AGE_KEY before running this script.
EOF
}

preflight_sops() {
  local repo_path="$1"
  local encrypted_target="$2"

  if [[ -f "$encrypted_target" ]]; then
    if ! sops --decrypt "$encrypted_target" >/dev/null 2>&1; then
      echo "Error: cannot decrypt existing target: ${encrypted_target}" >&2
      sops_key_help
      exit 1
    fi
    return
  fi

  # New file path: make sure encryption policy is likely available.
  if [[ ! -f "$repo_path/.sops.yaml" ]]; then
    echo "Warning: no .sops.yaml found at repo root ($repo_path)." >&2
    echo "Warning: encryption will rely on other sops key configuration." >&2
  fi

  local tmp_probe
  tmp_probe="$(mktemp)"
  echo '{}' > "$tmp_probe"
  if ! sops --encrypt --input-type json --output-type json "$tmp_probe" >/dev/null 2>&1; then
    rm -f "$tmp_probe"
    echo "Error: sops encryption preflight failed. Check recipient config (.sops.yaml) and key setup." >&2
    exit 1
  fi
  rm -f "$tmp_probe"
}

validate_local_json() {
  local json_file="$1"

  if [[ ! -f "$json_file" ]]; then
    echo "Error: local secrets file not found: $json_file" >&2
    exit 1
  fi

  if ! jq empty "$json_file" >/dev/null 2>&1; then
    echo "Error: local secrets file is not valid JSON: $json_file" >&2
    exit 1
  fi

  # Guardrail: expected top-level structure for mobile secret updates.
  if ! jq -e 'type == "object" and (.app? or .mobile?)' "$json_file" >/dev/null 2>&1; then
    echo "Error: local secrets JSON should contain at least one of top-level keys: app, mobile" >&2
    exit 1
  fi
}

prepare_repository() {
  local branch="$1"
  local repo_path="$2"
  local repo_url="$3"

  if [[ -n "$repo_path" ]]; then
    if [[ ! -d "$repo_path/.git" ]]; then
      echo "Error: --repo-path must point to a git repository: $repo_path" >&2
      exit 1
    fi

    WORK_REPO_PATH="$repo_path"
    TEMP_DIR=""

    pushd "$WORK_REPO_PATH" >/dev/null
    git fetch origin
    git checkout "$branch"
    git pull --ff-only origin "$branch"
    popd >/dev/null
    return
  fi

  if [[ -z "$repo_url" ]]; then
    echo "Error: provide either --repo-path or --config_repo" >&2
    exit 1
  fi

  TEMP_DIR="$(mktemp -d)"
  git clone "$repo_url" "$TEMP_DIR"
  WORK_REPO_PATH="$TEMP_DIR"

  pushd "$WORK_REPO_PATH" >/dev/null
  if git ls-remote --exit-code --heads origin "$branch" >/dev/null 2>&1; then
    git checkout "$branch"
  else
    git checkout -b "$branch"
  fi
  popd >/dev/null
}

cleanup() {
  if [[ -n "${TEMP_DIR:-}" && -d "$TEMP_DIR" ]]; then
    rm -rf "$TEMP_DIR"
  fi
}

ENVIRONMENT=""
LOCAL_SECRETS_FILE=""
REPO_PATH=""
CONFIG_REPO=""
BRANCH="main"
COMMIT_MESSAGE=""
TARGET_OVERRIDE=""
FORCE=false
TEMP_DIR=""
WORK_REPO_PATH=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --help|-h)
      usage
      exit 0
      ;;
    --repo-path)
      REPO_PATH="$2"
      shift 2
      ;;
    --config_repo)
      CONFIG_REPO="$2"
      shift 2
      ;;
    --branch)
      BRANCH="$2"
      shift 2
      ;;
    --message)
      COMMIT_MESSAGE="$2"
      shift 2
      ;;
    --target)
      TARGET_OVERRIDE="$2"
      shift 2
      ;;
    --force)
      FORCE=true
      shift
      ;;
    *)
      if [[ -z "$ENVIRONMENT" ]]; then
        ENVIRONMENT="$1"
      elif [[ -z "$LOCAL_SECRETS_FILE" ]]; then
        LOCAL_SECRETS_FILE="$1"
      else
        echo "Error: unexpected argument '$1'" >&2
        usage
        exit 1
      fi
      shift
      ;;
  esac
done

if [[ -z "$ENVIRONMENT" || -z "$LOCAL_SECRETS_FILE" ]]; then
  usage
  exit 1
fi

if [[ -n "$REPO_PATH" && -n "$CONFIG_REPO" ]]; then
  echo "Error: --repo-path and --config_repo are mutually exclusive" >&2
  exit 1
fi

require_tool git
require_tool jq
require_tool sops
validate_local_json "$LOCAL_SECRETS_FILE"

if [[ -z "$COMMIT_MESSAGE" ]]; then
  COMMIT_MESSAGE="update mobile secrets for ${ENVIRONMENT}"
fi

prepare_repository "$BRANCH" "$REPO_PATH" "$CONFIG_REPO"
trap cleanup EXIT

TARGET_RELATIVE_PATH="${TARGET_OVERRIDE:-mobile/${ENVIRONMENT}/build-secrets.enc.json}"
TARGET_ABSOLUTE_PATH="${WORK_REPO_PATH}/${TARGET_RELATIVE_PATH}"
TARGET_DIR="$(dirname "$TARGET_ABSOLUTE_PATH")"

preflight_sops "$WORK_REPO_PATH" "$TARGET_ABSOLUTE_PATH"

mkdir -p "$TARGET_DIR"

TMP_EXISTING="$(mktemp)"
TMP_MERGED="$(mktemp)"
trap 'rm -f "$TMP_EXISTING" "$TMP_MERGED"; cleanup' EXIT

if [[ -f "$TARGET_ABSOLUTE_PATH" ]]; then
  if [[ "$FORCE" != true ]]; then
    if ! confirm_action "Target file exists: ${TARGET_RELATIVE_PATH}. Overwrite"; then
      echo "Cancelled."
      exit 0
    fi
  fi

  sops --decrypt "$TARGET_ABSOLUTE_PATH" > "$TMP_EXISTING"
  jq -s '.[0] * .[1]' "$TMP_EXISTING" "$LOCAL_SECRETS_FILE" > "$TMP_MERGED"
else
  cp "$LOCAL_SECRETS_FILE" "$TMP_MERGED"
fi

if ! jq empty "$TMP_MERGED" >/dev/null 2>&1; then
  echo "Error: merged JSON is invalid; aborting." >&2
  exit 1
fi

sops --encrypt --input-type json --output-type json --output "$TARGET_ABSOLUTE_PATH" "$TMP_MERGED"

pushd "$WORK_REPO_PATH" >/dev/null

# Ensure we only stage the encrypted target file.
git add "$TARGET_RELATIVE_PATH"

if git diff --cached --quiet; then
  echo "No secret changes detected for ${TARGET_RELATIVE_PATH}."
  popd >/dev/null
  exit 0
fi

# Guardrail against accidentally staging plaintext secret files.
if git diff --cached --name-only | grep -E '\.json$' | grep -v "${TARGET_RELATIVE_PATH}" >/dev/null 2>&1; then
  echo "Error: unexpected JSON files staged. Refusing to commit." >&2
  git reset
  popd >/dev/null
  exit 1
fi

echo "Updated encrypted keys:"
jq -r 'paths(scalars) | map(tostring) | join(".")' "$TMP_MERGED" | sed 's/^/  - /'

git commit -m "$COMMIT_MESSAGE"
git push origin "$BRANCH"

popd >/dev/null

echo "Done: ${TARGET_RELATIVE_PATH} updated and pushed on branch ${BRANCH}."
