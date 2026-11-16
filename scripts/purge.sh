#!/bin/bash

# Purge local install and compile artifacts.
#
#   ./scripts/purge.sh .              # node_modules under <directory>
#   ./scripts/purge.sh --build        # hardcoded build/dist/CDK caches
#   ./scripts/purge.sh . --build      # both
#
# --build paths are listed explicitly so we never glob a source tree named
# build/ or dist/.

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"

usage() {
  echo "Usage: $0 [--build] [<directory>]"
  echo
  echo "  <directory>  Recursively delete node_modules under this path."
  echo "               Required unless --build is given alone."
  echo "  --build      Delete hardcoded compile output, dist folders, and"
  echo "               CDK asset caches for this repo (see BUILD_PATHS)."
}

# Compile / bundler / native / docs / CDK output only. Do not add source
# trees, public/, keys/, configs/, or cdk.context.json.
BUILD_PATHS=(
  # Root tsc (tsconfig.json outDir)
  "build"

  # API (api/tsconfig.json)
  "api/build"

  # App: Vite outDir, tsc outDir, sourcemap-mode Vite outDir
  "app/build"
  "app/dist"
  "app/build-sourcemap"

  # Android Gradle
  "app/android/build"
  "app/android/app/build"
  "app/android/capacitor-cordova-android-plugins/build"

  # iOS Xcode
  "app/ios/App/build"
  "app/ios/App/output"

  # Web (web/tsconfig.json / Vite default)
  "web/dist"

  # Shared libraries
  "library/data-model/build"
  "library/forms/dist"

  # Sphinx
  "docs/_build"
  "docs/user/_build"
  "docs/developer/docs/build"

  # CDK synth output and asset hashes (infrastructure/aws-cdk/.gitignore)
  "infrastructure/aws-cdk/cdk.out"
  "infrastructure/aws-cdk/.cdk.staging"
  "infrastructure/aws-cdk/dist"

  # Turbo task-output cache; leaving it would restore the folders above
  ".turbo"
)

remove_pnpm_cache() {
  local dir="$1"
  local items_removed=0

  while IFS= read -r -d '' node_modules_dir; do
    echo "Removing: $node_modules_dir"
    rm -rf "$node_modules_dir"
    items_removed=$((items_removed + 1))
  done < <(find "$dir" -type d -name "node_modules" -print0)

  echo "Cleaning complete. Removed $items_removed items."
}

remove_build_artifacts() {
  local items_removed=0
  local rel path

  echo "Removing compile output and CDK asset caches from: $repo_root"
  for rel in "${BUILD_PATHS[@]}"; do
    path="$repo_root/$rel"
    if [ -e "$path" ]; then
      echo "Removing: $path"
      rm -rf "$path"
      items_removed=$((items_removed + 1))
    fi
  done
  echo "Build purge complete. Removed $items_removed items."
}

purge_build=false
directory=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --build)
      purge_build=true
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    --)
      shift
      break
      ;;
    -*)
      echo "Error: unknown option $1"
      usage
      exit 1
      ;;
    *)
      if [ -n "$directory" ]; then
        echo "Error: extra argument $1"
        usage
        exit 1
      fi
      directory="$1"
      shift
      ;;
  esac
done

if [ -z "$directory" ] && [ "$purge_build" = false ]; then
  usage
  exit 1
fi

if [ -n "$directory" ]; then
  if [ ! -d "$directory" ]; then
    echo "Error: $directory is not a valid directory"
    exit 1
  fi
  echo "Starting to clean pnpm cache files from: $directory"
  remove_pnpm_cache "$directory"
fi

if [ "$purge_build" = true ]; then
  remove_build_artifacts
fi
