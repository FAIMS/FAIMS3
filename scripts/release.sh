#!/bin/bash
set -euo pipefail

# =============================================================================
# release.sh — FAIMS3 monorepo release automation
#
# Two-phase workflow (required because main is a protected branch):
#
#   PHASE 1 — prepare
#   ./scripts/release.sh prepare <version> [--dry-run]
#
#     1. Checks out a new branch release/v<version> from main.
#     2. Bumps the version in all package.json files and docs/user/conf.py.
#     3. Generates a CHANGELOG.md entry from merged PR titles since the last tag.
#     4. Opens $EDITOR so you can review/edit the changelog before committing.
#     5. Commits the changes and pushes the branch to origin.
#     6. Opens a draft pull request via `gh pr create`.
#
#   PHASE 2 — finalize
#   ./scripts/release.sh finalize <version> [--push]
#
#     Run this after the release PR has been reviewed and merged into main.
#     1. Checks you are on a clean main branch.
#     2. Verifies the release PR has been merged.
#     3. Creates an annotated git tag v<version> on HEAD.
#     4. Optionally pushes the tag to origin (requires --push).
#
# Prerequisites: git, jq, gh (GitHub CLI, authenticated)
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
SUBCOMMAND=""
NEW_VERSION=""
DO_PUSH=false
DRY_RUN=false

for arg in "$@"; do
  case "$arg" in
    --push)    DO_PUSH=true ;;
    --dry-run) DRY_RUN=true ;;
    -*)        echo "Unknown flag: $arg" >&2; exit 1 ;;
    *)
      if [[ -z "$SUBCOMMAND" ]]; then
        SUBCOMMAND="$arg"
      elif [[ -z "$NEW_VERSION" ]]; then
        NEW_VERSION="$arg"
      else
        echo "Unexpected argument: $arg" >&2; exit 1
      fi
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
info()  { echo "[release] $*"; }
warn()  { echo "[release] WARNING: $*" >&2; }
error() { echo "[release] ERROR: $*" >&2; exit 1; }

usage() {
  echo "Usage:" >&2
  echo "  $0 prepare <version> [--dry-run]" >&2
  echo "  $0 finalize <version> [--push]" >&2
  exit 1
}

# Wraps destructive commands so they are only printed in dry-run mode.
run() {
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[dry-run]  $*"
  else
    "$@"
  fi
}

# ---------------------------------------------------------------------------
# Shared: validate inputs and required tools
# ---------------------------------------------------------------------------
[[ -n "$SUBCOMMAND" ]] || usage
[[ -n "$NEW_VERSION" ]] || usage

if ! [[ "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9._-]+)?$ ]]; then
  error "Version '$NEW_VERSION' is not valid semver (e.g. 1.5.0 or 1.5.0-rc1)"
fi

for tool in git jq gh; do
  command -v "$tool" &>/dev/null || error "'$tool' is required but not found in PATH"
done

cd "$REPO_ROOT"

NEW_TAG="v$NEW_VERSION"
RELEASE_BRANCH="releases/$NEW_TAG"

# ---------------------------------------------------------------------------
# Shared: write/update CHANGELOG.md with a generated section
# ---------------------------------------------------------------------------
update_changelog() {
  local pr_entries="$1"
  local changelog="$REPO_ROOT/CHANGELOG.md"
  local release_date
  release_date=$(date +%Y-%m-%d)

  local new_section
  new_section="## [$NEW_VERSION] - $release_date

### Changes

$pr_entries
"

  if [[ "$DRY_RUN" == "true" ]]; then
    info "[dry-run]  Would prepend to CHANGELOG.md:"
    echo "---"
    echo "$new_section"
    echo "---"
    return
  fi

  local temp_section
  temp_section=$(mktemp)
  printf '%s' "$new_section" > "$temp_section"

  python3 - "$temp_section" "$changelog" << 'PYEOF'
import sys, os

section_file   = sys.argv[1]
changelog_file = sys.argv[2]

with open(section_file, 'r') as f:
    new_section = f.read()

HEADER = """\
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

"""

if not os.path.exists(changelog_file):
    content = HEADER + new_section + "\n"
else:
    with open(changelog_file, 'r') as f:
        content = f.read()
    idx = content.find('\n## [')
    if idx != -1:
        content = content[:idx + 1] + new_section + "\n" + content[idx + 1:]
    else:
        content = content.rstrip('\n') + '\n\n' + new_section + "\n"

with open(changelog_file, 'w') as f:
    f.write(content)
PYEOF

  rm -f "$temp_section"
  info "Updated CHANGELOG.md."
}

# ---------------------------------------------------------------------------
# Shared: bump version in all package files and add to git staging (but don't commit)
# ---------------------------------------------------------------------------
bump_versions() {
  local package_files=(
    "package.json"
    "api/package.json"
    "app/package.json"
    "web/package.json"
    "library/data-model/package.json"
    "library/forms/package.json"
  )

  for file in "${package_files[@]}"; do
    if [[ -f "$file" ]]; then
      if [[ "$DRY_RUN" == "true" ]]; then
        info "[dry-run]  Would update $file → $NEW_VERSION"
      else
        jq --arg v "$NEW_VERSION" '.version = $v' "$file" > "tmp.$$.json" \
          && mv "tmp.$$.json" "$file"
        info "Updated $file"
        git add "$file"
      fi
    else
      warn "$file does not exist, skipping."
    fi
  done

  if [[ -f "docs/user/conf.py" ]]; then
    if [[ "$DRY_RUN" == "true" ]]; then
      info "[dry-run]  Would update docs/user/conf.py → release = \"$NEW_VERSION\""
    else
      sed -e "s/release = \".*\"/release = \"$NEW_VERSION\"/" docs/user/conf.py \
        > "tmp.$$.py" && mv "tmp.$$.py" docs/user/conf.py
      info "Updated docs/user/conf.py"
      git add "docs/user/conf.py"
    fi
  else
    warn "docs/user/conf.py does not exist, skipping."
  fi
}

# ---------------------------------------------------------------------------
# Shared: gather merged PR entries since the previous tag
# ---------------------------------------------------------------------------
gather_pr_entries() {
  local prev_tag range_desc merge_log merged_pr_numbers pr_count gh_pr_data
  local pr_numbers_json pr_entries found_numbers

  prev_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo "")

  if [[ -z "$prev_tag" ]]; then
    warn "No previous tag found. Changelog will list all merged PRs (up to 500)."
    range_desc="(all history)"
    merge_log=$(git log --merges --pretty=format:"%s" 2>/dev/null || echo "")
  else
    info "Previous tag: $prev_tag"
    range_desc="since $prev_tag"
    merge_log=$(git log "${prev_tag}..HEAD" --merges --pretty=format:"%s" 2>/dev/null || echo "")
  fi

  merged_pr_numbers=$(echo "$merge_log" \
    | grep -oE '#[0-9]+' \
    | grep -oE '[0-9]+$' \
    | sort -rn \
    || echo "")

  pr_count=$(echo "$merged_pr_numbers" | grep -c '[0-9]' 2>/dev/null || true)
  pr_count=${pr_count:-0}
  info "Found $pr_count merged PR(s) $range_desc."

  if [[ "$pr_count" -gt 0 ]]; then
    info "Fetching PR details from GitHub..."
    gh_pr_data=$(gh pr list \
      --state merged \
      --base main \
      --limit 500 \
      --json number,title,url \
      2>/dev/null || echo "[]")

    pr_numbers_json=$(echo "$merged_pr_numbers" | grep '[0-9]' | jq -R 'tonumber' | jq -s '.')

    pr_entries=$(echo "$gh_pr_data" \
      | jq -r --argjson nums "$pr_numbers_json" \
          '[.[] | select(.number as $n | $nums | index($n) != null)]
           | sort_by(.number) | reverse
           | .[] | "- " + .title + " ([#" + (.number|tostring) + "](" + .url + "))"' \
      || echo "")

    found_numbers=$(echo "$gh_pr_data" \
      | jq -r --argjson nums "$pr_numbers_json" \
          '[.[] | select(.number as $n | $nums | index($n) != null)] | .[].number' \
      | sort -rn || echo "")

    while IFS= read -r num; do
      [[ -z "$num" ]] && continue
      if ! echo "$found_numbers" | grep -qx "$num"; then
        pr_entries="${pr_entries}"$'\n'"- Pull request #${num} (title unavailable — fetch manually)"
      fi
    done <<< "$merged_pr_numbers"

    pr_entries=$(echo "$pr_entries" | sed '/^[[:space:]]*$/d')
  else
    pr_entries="_No pull requests found $range_desc._"
  fi

  # Return value via stdout — caller captures with $()
  printf '%s' "$pr_entries"
}

# ===========================================================================
# SUBCOMMAND: prepare
# ===========================================================================
cmd_prepare() {
  info "=== prepare $NEW_TAG ==="
  [[ "$DRY_RUN" == "true" ]] && info "(DRY RUN — no files will be modified)"

  # ---- Pre-flight ----------------------------------------------------------
  info "--- Pre-flight checks ---"

  local current_branch
  current_branch=$(git rev-parse --abbrev-ref HEAD)

  if [[ "$current_branch" != "main" ]]; then
    if [[ "$DRY_RUN" == "true" ]]; then
      warn "Not on 'main' (currently on '$current_branch') — ignored in dry-run."
    else
      error "Must be on the 'main' branch (currently on '$current_branch')"
    fi
  fi

  # check for uncommitted changes, but ignore untracked files (e.g. local dev artifacts)
  if [[ -n "$(git status --untracked-files=no --porcelain)" ]]; then
    if [[ "$DRY_RUN" == "true" ]]; then
      warn "Working tree is not clean — ignored in dry-run."
    else
      error "Working tree is not clean. Commit or stash all changes before releasing."
    fi
  fi

  if git rev-parse "$NEW_TAG" &>/dev/null 2>&1; then
    error "Tag '$NEW_TAG' already exists."
  fi

  if git rev-parse "$RELEASE_BRANCH" &>/dev/null 2>&1; then
    error "Branch '$RELEASE_BRANCH' already exists. Delete it first if you want to re-prepare."
  fi

  info "Pre-flight checks passed."

  # ---- Create release branch -----------------------------------------------
  info "--- Creating branch $RELEASE_BRANCH ---"
  run git checkout -b "$RELEASE_BRANCH"

  # ---- Gather PRs ----------------------------------------------------------
  info "--- Gathering merged pull requests ---"
  local pr_entries
  pr_entries=$(gather_pr_entries)

  # ---- Bump versions -------------------------------------------------------
  info "--- Bumping versions to $NEW_VERSION ---"
  bump_versions

  # ---- Update CHANGELOG ----------------------------------------------------
  info "--- Updating CHANGELOG.md ---"
  update_changelog "$pr_entries"

  # ---- Open editor ---------------------------------------------------------
  if [[ "$DRY_RUN" == "false" ]]; then
    local editor="${EDITOR:-vi}"
    info "Opening CHANGELOG.md in $editor for review. Save and exit to continue."
    "$editor" "$REPO_ROOT/CHANGELOG.md"
  else
    info "[dry-run]  Would open \$EDITOR on CHANGELOG.md for review."
  fi

  # ---- Commit --------------------------------------------------------------
  info "--- Committing release changes ---"
  run git add CHANGELOG.md
  run git commit --signoff -m "Release $NEW_TAG"

  # ---- Push branch and open draft PR ---------------------------------------
  info "--- Pushing branch and opening draft PR ---"
  run git push origin "$RELEASE_BRANCH"

  if [[ "$DRY_RUN" == "true" ]]; then
    info "[dry-run]  Would open draft PR: '$NEW_TAG' from $RELEASE_BRANCH → main"
  else
    gh pr create \
      --draft \
      --base main \
      --head "$RELEASE_BRANCH" \
      --title "Release $NEW_TAG" \
      --body "Automated release PR for $NEW_TAG.

Please review the CHANGELOG.md entry and version bumps, then merge when ready.
After merging, run:

    ./scripts/release.sh finalize $NEW_VERSION --push"
    info "Draft PR created. Review, then merge it and run:"
    echo ""
    echo "    ./scripts/release.sh finalize $NEW_VERSION --push"
    echo ""
  fi
}

# ===========================================================================
# SUBCOMMAND: finalize
# ===========================================================================
cmd_finalize() {
  info "=== finalize $NEW_TAG ==="

  # ---- Pre-flight (always strict — no dry-run relaxation) ------------------
  info "--- Pre-flight checks ---"

  local current_branch
  current_branch=$(git rev-parse --abbrev-ref HEAD)
  [[ "$current_branch" == "main" ]] || \
    error "Must be on the 'main' branch (currently on '$current_branch')"

  [[ -z "$(git status --porcelain)" ]] || \
    error "Working tree is not clean. Pull the merged PR first."

  if git rev-parse "$NEW_TAG" &>/dev/null 2>&1; then
    error "Tag '$NEW_TAG' already exists."
  fi

  # ---- Verify the release PR was merged ------------------------------------
  info "--- Verifying release PR is merged ---"
  local merged_pr
  merged_pr=$(gh pr list \
    --state merged \
    --base main \
    --head "$RELEASE_BRANCH" \
    --json number,title \
    --limit 1 \
    2>/dev/null || echo "[]")

  if [[ "$merged_pr" == "[]" ]] || [[ -z "$merged_pr" ]]; then
    error "No merged PR found for branch '$RELEASE_BRANCH'. Merge the release PR first."
  fi

  local pr_number
  pr_number=$(echo "$merged_pr" | jq -r '.[0].number')
  info "Release PR #$pr_number is merged. Proceeding to tag."

  # ---- Create annotated tag ------------------------------------------------
  info "--- Creating annotated tag $NEW_TAG ---"
  run git tag -a "$NEW_TAG" -m "Release $NEW_TAG"
  [[ "$DRY_RUN" == "false" ]] && info "Created tag $NEW_TAG."

  # ---- Push tag ------------------------------------------------------------
  if [[ "$DO_PUSH" == "true" ]]; then
    run git push origin "$NEW_TAG"
    [[ "$DRY_RUN" == "false" ]] && info "Pushed tag $NEW_TAG to origin."
  else
    info "Tag was NOT pushed (no --push flag). When ready, run:"
    echo ""
    echo "    git push origin $NEW_TAG"
    echo ""
  fi

  echo ""
  info "========================================="
  info "Release $NEW_TAG finalized."
  info "========================================="
}

# ===========================================================================
# Dispatch
# ===========================================================================
case "$SUBCOMMAND" in
  prepare)  cmd_prepare ;;
  finalize) cmd_finalize ;;
  *) error "Unknown subcommand '$SUBCOMMAND'. Use 'prepare' or 'finalize'." ;;
esac
