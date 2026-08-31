#\!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_LOCAL_CONFIG_ROOT="${ROOT_DIR}/config"

usage() {
  cat <<EOF_USAGE
Usage:
  $0 <push|pull> <environment> [options]
  $0 <environment> <local_secrets_file> [options]   # legacy push form

Options:
  --repo-path <path>      Path to an already-cloned private config/match repo
  --config_repo <url>     Git URL of private config/match repo (used if --repo-path is not provided)
  --branch <name>         Branch to update (default: main)
  --message <text>        Commit message (default: update mobile secrets for <environment>)
  --target <path>         Target encrypted file path in repo
                          (default: mobile/<environment>/build-secrets.enc.json)
  --local-root <path>     Local mirror root for the private config repo (default: ${DEFAULT_LOCAL_CONFIG_ROOT})
  --source <path>         Local plaintext secrets JSON to push (push mode only)
  --force                 Overwrite target file or local mirror without prompt
  --help                  Show this help text

Behaviour:
  - push: validates a local JSON secret bundle, merges it with the repo copy, re-encrypts it, and updates the local mirror under config/<environment>/.
  - pull: clones or reuses the private repo, decrypts build-secrets.enc.json into config/<environment>/build-secrets.json, and mirrors the repo config files locally.
  - The script keeps a local copy of the repo contents under config/<environment>/ by default so the app workspace can work with a checked-out mirror.

Notes:
  - Requires: git, jq, sops
  - SOPS key discovery is handled by sops itself. Typical options:
      * SOPS_AGE_KEY (private key content)
      * SOPS_AGE_KEY_FILE (path to private key file)
      * Default local age key locations
  - Keep private keys out of command arguments and repository files.
  - The script never prints secret values.
EOF_USAGE
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
  cat >&2 <<'EOF_SOPS'
SOPS could not decrypt the target file.

Make sure your decryption key is available to sops, for example via:
  - SOPS_AGE_KEY
  - SOPS_AGE_KEY_FILE
  - a default local age key file

In CI, provide the private key through a bootstrap secret and export it as
SOPS_AGE_KEY before running this script.
EOF_SOPS
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
    if git rev-parse --verify "$branch" >/dev/null 2>&1; then
      git checkout "$branch"
    else
      git checkout -b "$branch"
    fi
    git pull --ff-only origin "$branch" || true
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

mirror_repo_to_local() {
  local repo_root="$1"
  local environment="$2"
  local local_root="$3"
  local repo_env_dir="$repo_root/mobile/$environment"

  mkdir -p "$local_root/$environment"

  if [[ -d "$repo_env_dir" ]]; then
    cp -R "$repo_env_dir"/. "$local_root/$environment/"
  else
    echo "Error: environment folder not found in repo: $repo_env_dir" >&2
    exit 1
  fi

  if [[ -f "$local_root/$environment/build-secrets.enc.json" ]]; then
    if sops --decrypt "$local_root/$environment/build-secrets.enc.json" >/dev/null 2>&1; then
      sops --decrypt "$local_root/$environment/build-secrets.enc.json" > "$local_root/$environment/build-secrets.json"
    fi
  fi
}

write_mirror_after_push() {
  local target_file="$1"
  local local_root="$2"
  local environment="$3"

  mkdir -p "$local_root/$environment"
  cp "$target_file" "$local_root/$environment/build-secrets.enc.json"

  if sops --decrypt "$target_file" >/dev/null 2>&1; then
    sops --decrypt "$target_file" > "$local_root/$environment/build-secrets.json"
  fi
}

push_config() {
  local environment="$1"
  local local_root="$2"
  local repo_path="$3"
  local repo_url="$4"
  local branch="$5"
  local commit_message="$6"
  local target_override="$7"
  local force="$8"
  local source_file="$9"

  require_tool git
  require_tool jq
  require_tool sops
  validate_local_json "$source_file"

  prepare_repository "$branch" "$repo_path" "$repo_url"
  trap cleanup EXIT

  local target_relative_path="${target_override:-mobile/${environment}/build-secrets.enc.json}"
  local target_absolute_path="${WORK_REPO_PATH}/${target_relative_path}"
  local target_dir
  target_dir="$(dirname "$target_absolute_path")"

  preflight_sops "$WORK_REPO_PATH" "$target_absolute_path"
  mkdir -p "$target_dir"

  local tmp_existing
  local tmp_merged
  tmp_existing="$(mktemp)"
  tmp_merged="$(mktemp)"
  trap 'rm -f "$tmp_existing" "$tmp_merged"; cleanup' EXIT

  if [[ -f "$target_absolute_path" ]]; then
    if [[ "$force" != true ]]; then
      if ! confirm_action "Target file exists: ${target_relative_path}. Overwrite"; then
        echo "Cancelled."
        exit 0
      fi
    fi
    sops --decrypt "$target_absolute_path" > "$tmp_existing"
    jq -s '.[0] * .[1]' "$tmp_existing" "$source_file" > "$tmp_merged"
  else
    cp "$source_file" "$tmp_merged"
  fi

  if ! jq empty "$tmp_merged" >/dev/null 2>&1; then
    echo "Error: merged JSON is invalid; aborting." >&2
    exit 1
  fi

  mkdir -p "$local_root/$environment"
  cp "$source_file" "$local_root/$environment/build-secrets.json"

  sops --encrypt --input-type json --output-type json --output "$target_absolute_path" "$tmp_merged"
  write_mirror_after_push "$target_absolute_path" "$local_root" "$environment"

  pushd "$WORK_REPO_PATH" >/dev/null
  git add "$target_relative_path"

  if git diff --cached --quiet; then
    echo "No secret changes detected for ${target_relative_path}."
    popd >/dev/null
    exit 0
  fi

  if git diff --cached --name-only | grep -E '\.json$' | grep -v "${target_relative_path}" >/dev/null 2>&1; then
    echo "Error: unexpected JSON files staged. Refusing to commit." >&2
    git reset
    popd >/dev/null
    exit 1
  fi

  echo "Updated encrypted keys:"
  jq -r 'paths(scalars) | map(tostring) | join(".")' "$tmp_merged" | sed 's/^/  - /'

  git commit -m "$commit_message"
  git push origin "$branch"

  popd >/dev/null
  echo "Done: ${target_relative_path} updated and pushed on branch ${branch}."
}

pull_config() {
  local environment="$1"
  local local_root="$2"
  local repo_path="$3"
  local repo_url="$4"
  local branch="$5"

  prepare_repository "$branch" "$repo_path" "$repo_url"
  trap cleanup EXIT

  local repo_env_dir="${WORK_REPO_PATH}/mobile/${environment}"
  if [[ ! -d "$repo_env_dir" ]]; then
    echo "Error: environment directory not found in repo: $repo_env_dir" >&2
    exit 1
  fi

  mkdir -p "$local_root/$environment"
  mirror_repo_to_local "$WORK_REPO_PATH" "$environment" "$local_root"
  echo "Pulled config mirror into ${local_root}/${environment}"
}

ENVIRONMENT=""
COMMAND="push"
LOCAL_ROOT="$DEFAULT_LOCAL_CONFIG_ROOT"
REPO_PATH=""
CONFIG_REPO=""
BRANCH="main"
COMMIT_MESSAGE=""
TARGET_OVERRIDE=""
FORCE=false
SOURCE_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    push|pull)
      COMMAND="$1"
      shift
      ;;
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
    --local-root)
      LOCAL_ROOT="$2"
      shift 2
      ;;
    --source)
      SOURCE_FILE="$2"
      shift 2
      ;;
    --force)
      FORCE=true
      shift
      ;;
    *)
      if [[ -z "$ENVIRONMENT" ]]; then
        ENVIRONMENT="$1"
      elif [[ -z "$SOURCE_FILE" && "$COMMAND" == "push" ]]; then
        SOURCE_FILE="$1"
      else
        echo "Error: unexpected argument '$1'" >&2
        usage
        exit 1
      fi
      shift
      ;;
  esac
done

if [[ -z "$ENVIRONMENT" ]]; then
  usage
  exit 1
fi

if [[ -n "$REPO_PATH" && -n "$CONFIG_REPO" ]]; then
  echo "Error: --repo-path and --config_repo are mutually exclusive" >&2
  exit 1
fi

if [[ -z "$COMMIT_MESSAGE" ]]; then
  COMMIT_MESSAGE="update mobile secrets for ${ENVIRONMENT}"
fi

mkdir -p "$LOCAL_ROOT"

if [[ "$COMMAND" == "push" ]]; then
  if [[ -z "$SOURCE_FILE" ]]; then
    SOURCE_FILE="${LOCAL_ROOT}/${ENVIRONMENT}/build-secrets.json"
  fi

  if [[ ! -f "$SOURCE_FILE" ]]; then
    echo "Error: no local JSON source found at ${SOURCE_FILE}." >&2
    echo "Create ${LOCAL_ROOT}/${ENVIRONMENT}/build-secrets.json or pass --source <path>." >&2
    exit 1
  fi

  push_config "$ENVIRONMENT" "$LOCAL_ROOT" "$REPO_PATH" "$CONFIG_REPO" "$BRANCH" "$COMMIT_MESSAGE" "$TARGET_OVERRIDE" "$FORCE" "$SOURCE_FILE"
else
  pull_config "$ENVIRONMENT" "$LOCAL_ROOT" "$REPO_PATH" "$CONFIG_REPO" "$BRANCH"
fi
