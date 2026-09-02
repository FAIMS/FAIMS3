#\!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_LOCAL_CONFIG_ROOT="${ROOT_DIR}/config"

usage() {
  cat <<EOF_USAGE
Usage:
  $0 <push|pull> <environment> [options]

Options:
  --repo-path <path>      Path to an already-cloned private config/match repo
  --config_repo <url>     Git URL of private config/match repo (used if --repo-path is not provided)
  --branch <name>         Branch to update (default: main)
  --message <text>        Commit message (default: update mobile config for <environment>)
  --local-root <path>     Local mirror root for the private config repo (default: ${DEFAULT_LOCAL_CONFIG_ROOT})
  --force                 Skip confirmation prompts
  --help                  Show this help text

Behaviour:
  - push: Treats config/<environment>/ as source of truth. Compares local build-config.json
          and build-secrets.json with remote repo versions. If either has changed, encrypts
          secrets and pushes both files to the remote repo at mobile/<environment>/.
  - pull: Clones or reuses the private repo, decrypts build-secrets.enc.json, and mirrors
          config files locally to config/<environment>/.
  - The script keeps a local copy of the repo contents under config/<environment>/ so the
          app workspace can work with a checked-out mirror.

Local config structure:
  config/<environment>/build-config.json      (source, plaintext)
  config/<environment>/build-secrets.json     (source, plaintext - git-ignored)
  config/<environment>/build-secrets.enc.json (cache, encrypted)

Remote repo structure:
  mobile/<environment>/build-config.json      (plaintext)
  mobile/<environment>/build-secrets.enc.json (encrypted)

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
  local is_secrets="${2:-false}"

  if [[ ! -f "$json_file" ]]; then
    echo "Error: local config file not found: $json_file" >&2
    exit 1
  fi

  if ! jq empty "$json_file" >/dev/null 2>&1; then
    echo "Error: local config file is not valid JSON: $json_file" >&2
    exit 1
  fi

  # Only validate structure for secrets file
  if [[ "$is_secrets" == "true" ]]; then
    if ! jq -e 'type == "object"' "$json_file" >/dev/null 2>&1; then
      echo "Error: local secrets JSON should be an object" >&2
      exit 1
    fi
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

  if [[ ! -d "$repo_env_dir" ]]; then
    echo "Error: environment folder not found in repo: $repo_env_dir" >&2
    exit 1
  fi

  # Mirror build-config.json (plaintext)
  if [[ -f "$repo_env_dir/build-config.json" ]]; then
    cp "$repo_env_dir/build-config.json" "$local_root/$environment/build-config.json"
  fi

  # Mirror build-secrets.enc.json and decrypt it
  if [[ -f "$repo_env_dir/build-secrets.enc.json" ]]; then
    cp "$repo_env_dir/build-secrets.enc.json" "$local_root/$environment/build-secrets.enc.json"
    if sops --decrypt "$local_root/$environment/build-secrets.enc.json" >/dev/null 2>&1; then
      sops --decrypt "$local_root/$environment/build-secrets.enc.json" > "$local_root/$environment/build-secrets.json"
    fi
  fi
}

write_mirror_after_push() {
  local secrets_file="$1"
  local config_file="$2"
  local local_root="$3"
  local environment="$4"

  mkdir -p "$local_root/$environment"
  
  # Mirror plaintext config (already local, but ensure it's there)
  if [[ -f "$config_file" ]]; then
    cp "$config_file" "$local_root/$environment/build-config.json"
  fi
  
  # Mirror encrypted secrets and decrypt it
  cp "$secrets_file" "$local_root/$environment/build-secrets.enc.json"
  if sops --decrypt "$secrets_file" >/dev/null 2>&1; then
    sops --decrypt "$secrets_file" > "$local_root/$environment/build-secrets.json"
  fi
}

push_config() {
  local environment="$1"
  local local_root="$2"
  local repo_path="$3"
  local repo_url="$4"
  local branch="$5"
  local commit_message="$6"
  local force="$7"

  require_tool git
  require_tool jq
  require_tool sops

  local local_config_file="${local_root}/${environment}/build-config.json"
  local local_secrets_file="${local_root}/${environment}/build-secrets.json"

  # Validate local files exist and are valid JSON
  if [[ ! -f "$local_config_file" ]]; then
    echo "Error: local build-config.json not found at ${local_config_file}" >&2
    echo "Please create config/${environment}/build-config.json in your local workspace." >&2
    exit 1
  fi

  if [[ ! -f "$local_secrets_file" ]]; then
    echo "Error: local build-secrets.json not found at ${local_secrets_file}" >&2
    echo "Please create config/${environment}/build-secrets.json in your local workspace." >&2
    exit 1
  fi

  validate_local_json "$local_config_file" false
  validate_local_json "$local_secrets_file" true

  prepare_repository "$branch" "$repo_path" "$repo_url"
  trap cleanup EXIT

  local repo_config_path="mobile/${environment}/build-config.json"
  local repo_secrets_path="mobile/${environment}/build-secrets.enc.json"
  local repo_config_file="${WORK_REPO_PATH}/${repo_config_path}"
  local repo_secrets_file="${WORK_REPO_PATH}/${repo_secrets_path}"
  local repo_env_dir="${WORK_REPO_PATH}/mobile/${environment}"

  preflight_sops "$WORK_REPO_PATH" "$repo_secrets_file"
  mkdir -p "$repo_env_dir"

  local tmp_existing_secrets
  local tmp_merged_secrets
  local config_changed=false
  local secrets_changed=false

  tmp_existing_secrets="$(mktemp)"
  tmp_merged_secrets="$(mktemp)"
  trap 'rm -f "$tmp_existing_secrets" "$tmp_merged_secrets"; cleanup' EXIT

  # Check if build-config.json has changed
  if [[ -f "$repo_config_file" ]]; then
    if ! diff -q "$local_config_file" "$repo_config_file" >/dev/null 2>&1; then
      config_changed=true
    fi
  else
    config_changed=true
  fi

  # Check if build-secrets.json has changed (decrypt existing encrypted version if present)
  if [[ -f "$repo_secrets_file" ]]; then
    if ! sops --decrypt "$repo_secrets_file" > "$tmp_existing_secrets" 2>&1; then
      echo "Error: cannot decrypt existing remote secrets file: ${repo_secrets_file}" >&2
      sops_key_help
      exit 1
    fi
    if ! diff -q "$local_secrets_file" "$tmp_existing_secrets" >/dev/null 2>&1; then
      secrets_changed=true
    fi
  else
    secrets_changed=true
  fi

  # If nothing has changed, exit early
  if [[ "$config_changed" == false && "$secrets_changed" == false ]]; then
    echo "No changes detected in build-config.json or build-secrets.json for ${environment}."
    exit 0
  fi

  # Ask for confirmation if not forcing
  if [[ "$force" != true ]]; then
    echo "Changes detected:"
    [[ "$config_changed" == true ]] && echo "  - build-config.json"
    [[ "$secrets_changed" == true ]] && echo "  - build-secrets.json"
    if ! confirm_action "Push these changes to ${repo_config_path} and ${repo_secrets_path}"; then
      echo "Cancelled."
      exit 0
    fi
  fi

  # Update build-config.json
  cp "$local_config_file" "$repo_config_file"

  # Encrypt and update build-secrets.json
  sops --encrypt --input-type json --output-type json --output "$repo_secrets_file" "$local_secrets_file"

  pushd "$WORK_REPO_PATH" >/dev/null
  git add "$repo_config_path" "$repo_secrets_path"

  if git diff --cached --quiet; then
    echo "No changes to commit."
    popd >/dev/null
    exit 0
  fi

  if git diff --cached --name-only | grep -E '\.json$' | grep -v "$repo_config_path" | grep -v "$repo_secrets_path" >/dev/null 2>&1; then
    echo "Error: unexpected JSON files staged. Refusing to commit." >&2
    git reset
    popd >/dev/null
    exit 1
  fi

  echo "Updated encrypted keys:"
  jq -r 'paths(scalars) | map(tostring) | join(".")' "$local_secrets_file" | sed 's/^/  - /'

  git commit -m "$commit_message"
  git push origin "$branch"

  popd >/dev/null

  # Update local mirror
  write_mirror_after_push "$repo_secrets_file" "$repo_config_file" "$local_root" "$environment"

  echo "Done: pushed changes to ${repo_config_path} and ${repo_secrets_path} on branch ${branch}."
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
FORCE=false

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
    --local-root)
      LOCAL_ROOT="$2"
      shift 2
      ;;
    --force)
      FORCE=true
      shift
      ;;
    *)
      if [[ -z "$ENVIRONMENT" ]]; then
        ENVIRONMENT="$1"
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
  COMMIT_MESSAGE="update mobile config for ${ENVIRONMENT}"
fi

mkdir -p "$LOCAL_ROOT"

if [[ "$COMMAND" == "push" ]]; then
  push_config "$ENVIRONMENT" "$LOCAL_ROOT" "$REPO_PATH" "$CONFIG_REPO" "$BRANCH" "$COMMIT_MESSAGE" "$FORCE"
else
  pull_config "$ENVIRONMENT" "$LOCAL_ROOT" "$REPO_PATH" "$CONFIG_REPO" "$BRANCH"
fi
