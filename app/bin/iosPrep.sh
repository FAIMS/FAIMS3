#!/usr/bin/env bash
# Prepare the Capacitor iOS project and open it in Xcode.
#
# Builds shared libs + the Vite app, regenerates iOS config from app/.env,
# syncs native plugins/pods, then opens the workspace.
#
# Usage (from repo root or app/):
#   ./app/bin/iosPrep.sh
#   ./bin/iosPrep.sh

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${APP_DIR}/.." && pwd)"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "iosPrep.sh must be run on macOS." >&2
  exit 1
fi

# cap sync runs `bundle exec pod install` against app/ios/App/Gemfile.
# Prefer rbenv (Ruby 3.3.1) over the system /usr/bin/bundle.
if command -v rbenv >/dev/null 2>&1; then
  eval "$(rbenv init - bash)"
fi

echo "==> turbo build --filter=@faims3/app"
(cd "${REPO_ROOT}" && pnpm exec turbo build --filter=@faims3/app)

echo "==> prebuildConfig (runconfig)"
(cd "${APP_DIR}" && pnpm run runconfig)

echo "==> configIOSbuild (Info.plist + project.pbxproj)"
(cd "${APP_DIR}" && pnpm run configIOSbuild)

echo "==> cap sync ios"
(cd "${APP_DIR}" && npx cap sync ios)

echo "==> cap open ios"
(cd "${APP_DIR}" && npx cap open ios)
