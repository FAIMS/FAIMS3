#!/bin/bash
# Docker Compose v2 plugin for Amazon Linux 2023 (not in dnf repos).
set -euo pipefail

install_docker_compose() {
  if docker compose version >/dev/null 2>&1; then
    return 0
  fi

  local version="${DOCKER_COMPOSE_VERSION:-v2.32.4}"
  local arch plugin_dir plugin_path

  arch="$(uname -m)"
  plugin_dir="/usr/libexec/docker/cli-plugins"
  plugin_path="${plugin_dir}/docker-compose"

  echo "Installing Docker Compose ${version} to ${plugin_path}..." >&2
  mkdir -p "$plugin_dir"
  curl -fsSL \
    "https://github.com/docker/compose/releases/download/${version}/docker-compose-linux-${arch}" \
    -o "$plugin_path"
  chmod +x "$plugin_path"
  docker compose version
}

install_docker_compose "$@"
