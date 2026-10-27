#\!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_LOCAL_CONFIG_ROOT="${ROOT_DIR}/config"

# Tracked build artifacts: files generated/mutated by tooling during a build
# or deploy (not config), synced between a fixed home in this repo and the
# env folder in the config repo so non-deterministic resolutions (AMIs, AZs,
# subnets, ...) stay reproducible across machines. Format per entry:
#   "<name in env dir>:<home path relative to the FAIMS3 repo root>"
# Add future artifacts here; sync semantics are generic (presence-tolerant,
# home file is the push source of truth, --no-artifacts skips all).
TRACKED_ARTIFACTS=(
  "cdk.context.json:infrastructure/aws-cdk/cdk.context.json"
)

usage() {
  cat <<EOF_USAGE
Usage:
  $0 <push|pull> <environment> [options]

Options:
  --repo-path <path>      Path to an already-cloned private config/match repo
  --config-repo <url>     Git URL of private config/match repo (used if --repo-path is not provided)
  --branch <name>         Branch to update (default: main)
  --message <text>        Commit message (default: update config for <environment>)
  --local-root <path>     Local mirror root for the private config repo (default: ${DEFAULT_LOCAL_CONFIG_ROOT})
  --config-path <path>    Base path within the config repo where env folders live (default: configs)
  --no-artifacts          Skip tracked build artifact sync (see below)
  --force                 Skip confirmation prompts
  --help                  Show this help text

Behaviour:
  - push: Treats config/<environment>/ as source of truth. Compares the local
          files with the remote repo versions and pushes whatever changed:
          core.json (and aws.json when present) as plaintext, secrets.json
          encrypted to secrets.enc.json when present.
  - pull: Clones or reuses the private repo and mirrors the env folder locally
          to config/<environment>/, decrypting secrets.enc.json when present.
  - Tracked build artifacts: files generated/mutated by tooling during a
          build or deploy (not config) can be synced between a fixed home in
          this repo and the env folder in the config repo, so resolutions
          stay reproducible across machines. Currently tracked:
          cdk.context.json (CDK context cache: AMI/AZ/subnet resolutions;
          home: infrastructure/aws-cdk/cdk.context.json). Artifacts are
          presence-tolerant: missing on either side is a no-op, and the
          home file is the push source of truth. Skip with --no-artifacts.
  - The script keeps a local copy of the repo contents under config/<environment>/ so
    every consumer (app/web/api builds, the AWS CDK via CONFIG_ENV/CONFIG_DIR,
    local dev) can work against a checked-out mirror.

Local config structure (config/<environment>/):
  core.json        (source, plaintext - the shared non-secret config)
  aws.json         (optional, plaintext - AWS-only extension: stack/Fargate/
                    domains + Secrets Manager ARNs, never secret values;
                    consumed by the AWS CDK, ignored elsewhere)
  secrets.json     (optional, plaintext - git-ignored; partial-core secret
                    overlay for non-AWS consumers / local dev replicas)
  secrets.enc.json (cache, encrypted form of secrets.json)

Remote repo structure (<config-path>/<environment>/):
  core.json        (plaintext)
  aws.json         (plaintext, when the env has an AWS deployment)
  secrets.enc.json (encrypted, optional - see below)

secrets.enc.json is OPTIONAL. Pure AWS + mobile deployments do not need one:
AWS secret values live in Secrets Manager (aws.json carries ARNs only) and
app signing is handled by fastlane/match + CI-provided environment. Keep one
only when a deployment puts secret values in the overlay (e.g. private map
keys, auth/SMTP/CouchDB secrets) or to replicate an env locally with real
credentials. Environments without it pull and push cleanly.

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
    echo "Error: provide either --repo-path or --config-repo" >&2
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
  local repo_env_dir="$repo_root/${CONFIG_PATH}/$environment"

  mkdir -p "$local_root/$environment"

  if [[ ! -d "$repo_env_dir" ]]; then
    echo "Error: environment folder not found in repo: $repo_env_dir" >&2
    exit 1
  fi

  # Mirror core.json (plaintext)
  if [[ -f "$repo_env_dir/core.json" ]]; then
    cp "$repo_env_dir/core.json" "$local_root/$environment/core.json"
  fi

  # Mirror aws.json (plaintext, optional - AWS CDK extension)
  if [[ -f "$repo_env_dir/aws.json" ]]; then
    cp "$repo_env_dir/aws.json" "$local_root/$environment/aws.json"
  fi

  # Mirror secrets.enc.json and decrypt it
  if [[ -f "$repo_env_dir/secrets.enc.json" ]]; then
    cp "$repo_env_dir/secrets.enc.json" "$local_root/$environment/secrets.enc.json"
    echo "Decrypting secrets.enc.json for environment $environment"
    if sops --decrypt "$local_root/$environment/secrets.enc.json" >/dev/null 2>&1; then
      sops --decrypt "$local_root/$environment/secrets.enc.json" > "$local_root/$environment/secrets.json"
    else
      echo "Error: Failed to decrypt secrets.enc.json for environment $environment, is SOPS installed and configured correctly?" >&2
      exit 1
    fi
  fi
}

write_mirror_after_push() {
  local repo_env_dir="$1"
  local local_root="$2"
  local environment="$3"

  mkdir -p "$local_root/$environment"

  # Mirror plaintext files (already local, but ensure the mirror matches
  # what was just pushed)
  if [[ -f "$repo_env_dir/core.json" ]]; then
    cp "$repo_env_dir/core.json" "$local_root/$environment/core.json"
  fi
  if [[ -f "$repo_env_dir/aws.json" ]]; then
    cp "$repo_env_dir/aws.json" "$local_root/$environment/aws.json"
  fi

  # Mirror encrypted secrets and decrypt it (optional - many envs have none)
  if [[ -f "$repo_env_dir/secrets.enc.json" ]]; then
    cp "$repo_env_dir/secrets.enc.json" "$local_root/$environment/secrets.enc.json"
    if sops --decrypt "$repo_env_dir/secrets.enc.json" >/dev/null 2>&1; then
      sops --decrypt "$repo_env_dir/secrets.enc.json" > "$local_root/$environment/secrets.json"
    fi
  fi
}

# --- Tracked build artifacts (see TRACKED_ARTIFACTS) -----------------------
# Artifacts live in two places: a fixed home in this repo (where the tool
# reads/writes them) and the env folder in the config repo (the synced
# copy). They deliberately bypass the config/<env>/ local mirror: the home
# file is the live one, so there are only ever two copies, never a third
# stale one nobody reads.

# Prints "<name> <home-absolute-path> <env-dir-absolute-path>" lines for
# each registered artifact. Usage: artifact_entries <repo_env_dir>
artifact_entries() {
  local repo_env_dir="$1"
  local entry
  for entry in "${TRACKED_ARTIFACTS[@]:-}"; do
    [[ -z "$entry" ]] && continue
    echo "${entry%%:*} ${ROOT_DIR}/${entry#*:} ${repo_env_dir}/${entry%%:*}"
  done
}

# Pull side: repo env folder -> home, for artifacts present in the repo.
pull_artifacts() {
  local repo_env_dir="$1"
  local name home repo_file
  while read -r name home repo_file; do
    [[ -z "$name" ]] && continue
    if [[ -f "$repo_file" ]]; then
      mkdir -p "$(dirname "$home")"
      cp "$repo_file" "$home"
      echo "Synced artifact ${name} -> ${home#"${ROOT_DIR}"/}"
    fi
  done < <(artifact_entries "$repo_env_dir")
}

push_config() {
  local environment="$1"
  local local_root="$2"
  local repo_path="$3"
  local repo_url="$4"
  local branch="$5"
  local commit_message="$6"
  local force="$7"
  local sync_artifacts="${8:-true}"

  require_tool git
  require_tool jq

  local local_config_file="${local_root}/${environment}/core.json"
  local local_aws_file="${local_root}/${environment}/aws.json"
  local local_secrets_file="${local_root}/${environment}/secrets.json"

  # core.json is the only required file. aws.json (AWS CDK extension) and
  # secrets.json (SOPS overlay) are optional per environment: many envs are
  # AWS + mobile only, where AWS secrets live in Secrets Manager and app
  # signing is fastlane/match + CI env, so no overlay is needed at all.
  if [[ ! -f "$local_config_file" ]]; then
    echo "Error: local core.json not found at ${local_config_file}" >&2
    echo "Please create config/${environment}/core.json in your local workspace." >&2
    exit 1
  fi

  local has_aws=false
  local has_secrets=false
  [[ -f "$local_aws_file" ]] && has_aws=true
  [[ -f "$local_secrets_file" ]] && has_secrets=true

  validate_local_json "$local_config_file" false
  if [[ "$has_aws" == true ]]; then
    validate_local_json "$local_aws_file" false
  fi
  if [[ "$has_secrets" == true ]]; then
    require_tool sops
    validate_local_json "$local_secrets_file" true
  fi

  prepare_repository "$branch" "$repo_path" "$repo_url"

  local repo_config_path="${CONFIG_PATH}/${environment}/core.json"
  local repo_aws_path="${CONFIG_PATH}/${environment}/aws.json"
  local repo_secrets_path="${CONFIG_PATH}/${environment}/secrets.enc.json"
  local repo_config_file="${WORK_REPO_PATH}/${repo_config_path}"
  local repo_aws_file="${WORK_REPO_PATH}/${repo_aws_path}"
  local repo_secrets_file="${WORK_REPO_PATH}/${repo_secrets_path}"
  local repo_env_dir="${WORK_REPO_PATH}/${CONFIG_PATH}/${environment}"

  if [[ "$has_secrets" == true ]]; then
    preflight_sops "$WORK_REPO_PATH" "$repo_secrets_file"
  fi
  mkdir -p "$repo_env_dir"

  local tmp_existing_secrets=""
  local config_changed=false
  local aws_changed=false
  local secrets_changed=false

  tmp_existing_secrets="$(mktemp)"
  trap 'rm -f "${tmp_existing_secrets:-}"; cleanup' EXIT

  # Check if core.json has changed
  if [[ -f "$repo_config_file" ]]; then
    if ! diff -q "$local_config_file" "$repo_config_file" >/dev/null 2>&1; then
      config_changed=true
    fi
  else
    config_changed=true
  fi

  # Check if aws.json has changed (only when this env has one locally;
  # a locally-absent aws.json never deletes or touches the remote one)
  if [[ "$has_aws" == true ]]; then
    if [[ -f "$repo_aws_file" ]]; then
      if ! diff -q "$local_aws_file" "$repo_aws_file" >/dev/null 2>&1; then
        aws_changed=true
      fi
    else
      aws_changed=true
    fi
  fi

  # Check if secrets.json has changed (decrypt existing encrypted version if
  # present). No local secrets.json -> remote secrets.enc.json, if any, is
  # left untouched.
  if [[ "$has_secrets" == true ]]; then
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
  fi

  # Check tracked build artifacts (e.g. cdk.context.json). The home file in
  # this repo is the source of truth (tooling mutates it during builds /
  # deploys); absent at home -> any remote copy is left untouched.
  local artifacts_changed=false
  local -a changed_artifact_names=()
  local -a changed_artifact_homes=()
  local -a changed_artifact_repo_paths=()
  if [[ "$sync_artifacts" == true ]]; then
    local a_name a_home a_repo_file
    while read -r a_name a_home a_repo_file; do
      [[ -z "$a_name" ]] && continue
      if [[ -f "$a_home" ]]; then
        if [[ ! -f "$a_repo_file" ]] || ! diff -q "$a_home" "$a_repo_file" >/dev/null 2>&1; then
          artifacts_changed=true
          changed_artifact_names+=("$a_name")
          changed_artifact_homes+=("$a_home")
          changed_artifact_repo_paths+=("${CONFIG_PATH}/${environment}/${a_name}")
        fi
      fi
    done < <(artifact_entries "$repo_env_dir")
  fi

  # If nothing has changed, exit early
  if [[ "$config_changed" == false && "$aws_changed" == false && "$secrets_changed" == false && "$artifacts_changed" == false ]]; then
    echo "No changes detected for ${environment}."
    exit 0
  fi

  # Ask for confirmation if not forcing
  if [[ "$force" != true ]]; then
    echo "Changes detected:"
    [[ "$config_changed" == true ]] && echo "  - core.json"
    [[ "$aws_changed" == true ]] && echo "  - aws.json"
    [[ "$secrets_changed" == true ]] && echo "  - secrets.json"
    for a_name in "${changed_artifact_names[@]:-}"; do
      [[ -n "$a_name" ]] && echo "  - ${a_name} (tracked artifact)"
    done
    if ! confirm_action "Push these changes to ${CONFIG_PATH}/${environment}/"; then
      echo "Cancelled."
      exit 0
    fi
  fi

  # Update plaintext files
  cp "$local_config_file" "$repo_config_file"
  if [[ "$aws_changed" == true ]]; then
    cp "$local_aws_file" "$repo_aws_file"
  fi

  # Update tracked artifacts (home -> repo env folder)
  local i
  for i in "${!changed_artifact_names[@]}"; do
    cp "${changed_artifact_homes[$i]}" "${WORK_REPO_PATH}/${changed_artifact_repo_paths[$i]}"
  done

  # Encrypt and update secrets.json (optional)
  if [[ "$secrets_changed" == true ]]; then
    sops --encrypt --input-type json --output-type json --output "$repo_secrets_file" "$local_secrets_file"
  fi

  pushd "$WORK_REPO_PATH" >/dev/null
  git add "$repo_config_path"
  [[ "$aws_changed" == true ]] && git add "$repo_aws_path"
  [[ "$secrets_changed" == true ]] && git add "$repo_secrets_path"
  for p in "${changed_artifact_repo_paths[@]:-}"; do
    [[ -n "$p" ]] && git add "$p"
  done

  if git diff --cached --quiet; then
    echo "No changes to commit."
    popd >/dev/null
    exit 0
  fi

  # Refuse to commit JSON files beyond the ones this push is meant to touch.
  local staged allowed staged_ok
  while IFS= read -r staged; do
    [[ -z "$staged" ]] && continue
    case "$staged" in
      *.json) ;;
      *) continue ;;
    esac
    staged_ok=false
    for allowed in "$repo_config_path" "$repo_aws_path" "$repo_secrets_path" "${changed_artifact_repo_paths[@]:-}"; do
      if [[ "$staged" == "$allowed" ]]; then
        staged_ok=true
        break
      fi
    done
    if [[ "$staged_ok" != true ]]; then
      echo "Error: unexpected JSON files staged (${staged}). Refusing to commit." >&2
      git reset
      popd >/dev/null
      exit 1
    fi
  done < <(git diff --cached --name-only)

  if [[ "$secrets_changed" == true ]]; then
    echo "Updated encrypted keys:"
    jq -r 'paths(scalars) | map(tostring) | join(".")' "$local_secrets_file" | sed 's/^/  - /'
  fi

  git commit -m "$commit_message"
  git push origin "$branch"

  popd >/dev/null

  # Update local mirror
  write_mirror_after_push "$repo_env_dir" "$local_root" "$environment"

  echo "Done: pushed changes to ${CONFIG_PATH}/${environment}/ on branch ${branch}."
}

pull_config() {
  local environment="$1"
  local local_root="$2"
  local repo_path="$3"
  local repo_url="$4"
  local branch="$5"
  local sync_artifacts="${6:-true}"

  prepare_repository "$branch" "$repo_path" "$repo_url"
  trap cleanup EXIT

  local repo_env_dir="${WORK_REPO_PATH}/${CONFIG_PATH}/${environment}"
  if [[ ! -d "$repo_env_dir" ]]; then
    echo "Error: environment directory not found in repo: $repo_env_dir" >&2
    exit 1
  fi

  mkdir -p "$local_root/$environment"
  mirror_repo_to_local "$WORK_REPO_PATH" "$environment" "$local_root"
  if [[ "$sync_artifacts" == true ]]; then
    pull_artifacts "$repo_env_dir"
  fi
  echo "Pulled config mirror into ${local_root}/${environment}"
}

ENVIRONMENT=""
COMMAND="push"
LOCAL_ROOT="$DEFAULT_LOCAL_CONFIG_ROOT"
REPO_PATH=""
CONFIG_REPO=""
CONFIG_PATH="configs"
BRANCH="main"
COMMIT_MESSAGE=""
FORCE=false
SYNC_ARTIFACTS=true

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
    --config-repo)
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
    --config-path)
      CONFIG_PATH="$2"
      shift 2
      ;;
    --force)
      FORCE=true
      shift
      ;;
    --no-artifacts)
      SYNC_ARTIFACTS=false
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
  echo "Error: --repo-path and --config-repo are mutually exclusive" >&2
  exit 1
fi

if [[ -z "$COMMIT_MESSAGE" ]]; then
  COMMIT_MESSAGE="update config for ${ENVIRONMENT}"
fi

mkdir -p "$LOCAL_ROOT"

if [[ "$COMMAND" == "push" ]]; then
  push_config "$ENVIRONMENT" "$LOCAL_ROOT" "$REPO_PATH" "$CONFIG_REPO" "$BRANCH" "$COMMIT_MESSAGE" "$FORCE" "$SYNC_ARTIFACTS"
else
  pull_config "$ENVIRONMENT" "$LOCAL_ROOT" "$REPO_PATH" "$CONFIG_REPO" "$BRANCH" "$SYNC_ARTIFACTS"
fi
