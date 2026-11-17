terraform {
  required_providers {
    external = {
      source  = "hashicorp/external"
      version = ">= 2.3.0"
    }
  }
}

variable "config_dir" {
  description = "Path to the deployment config directory containing core.json, do.json, and optional secrets.enc.json."
  type        = string
}

variable "platform" {
  description = "Platform env to generate (api or apps)."
  type        = string

  validation {
    condition     = contains(["api", "apps"], var.platform)
    error_message = "platform must be either 'api' or 'apps'."
  }
}

locals {
  config_dir = abspath(var.config_dir)
}

# Build config is generated from core.json + do.json, with optional SOPS
# decryption of secrets.enc.json. The decrypted overlay is also used to split
# generated env into secret and non-secret sets without hardcoding key allowlists.

data "external" "generated_env" {
  program = [
    "bash",
    "-lc",
    <<-EOT
      set -euo pipefail
      cd "${path.module}/../../../../"
      base_config_file="$(mktemp)"
      merged_config_file="$(mktemp)"
      trap 'rm -f "$base_config_file" "$merged_config_file"' EXIT

      python3 - "$base_config_file" "$merged_config_file" "${local.config_dir}" <<'PY'
import json
import os
import pathlib
import subprocess
import sys

base_config_path = pathlib.Path(sys.argv[1])
merged_config_path = pathlib.Path(sys.argv[2])
config_dir = pathlib.Path(sys.argv[3])

def deep_merge(a, b):
    if isinstance(a, dict) and isinstance(b, dict):
        out = dict(a)
        for key, value in b.items():
            if key in out:
                out[key] = deep_merge(out[key], value)
            else:
                out[key] = value
        return out
    return b

core = json.loads((config_dir / 'core.json').read_text())
do_cfg = json.loads((config_dir / 'do.json').read_text())
base = deep_merge(core, do_cfg)
merged = base
has_secrets_overlay = False

secrets_enc_path = config_dir / 'secrets.enc.json'
if secrets_enc_path.exists():
    has_secrets_overlay = True
    has_sops_key = bool(
        os.environ.get('SOPS_AGE_KEY', '').strip()
        or os.environ.get('SOPS_AGE_KEY_FILE', '').strip()
    )
    if not has_sops_key:
        raise SystemExit(
            f"{secrets_enc_path} is present but SOPS_AGE_KEY / SOPS_AGE_KEY_FILE is not set."
        )
    try:
        decrypted = subprocess.check_output(
            ['sops', '--decrypt', str(secrets_enc_path)],
            text=True,
        )
    except Exception as exc:
        raise SystemExit(f"Failed to decrypt {secrets_enc_path} with sops: {exc}")
    secrets_cfg = json.loads(decrypted)
    merged = deep_merge(merged, secrets_cfg)

base_config_path.write_text(json.dumps(base))
merged_config_path.write_text(json.dumps(merged))

def generate_env(config_path):
    return subprocess.check_output(
        [
            'pnpm',
            'exec',
            'tsx',
            './library/build-config/src/generate-build-config.ts',
            '--config',
            str(config_path),
            '--platform',
            '${var.platform}',
        ],
        text=True,
    )

def parse_env(text):
    env = {}
    for line in text.splitlines():
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        env[key] = value
    return env

base_env = parse_env(generate_env(base_config_path))
merged_env = parse_env(generate_env(merged_config_path))

secret_keys = []
if has_secrets_overlay:
    for key, value in merged_env.items():
        if base_env.get(key) != value:
            secret_keys.append(key)

public_env = {
    key: value for key, value in merged_env.items() if key not in set(secret_keys)
}
secret_env = {key: merged_env[key] for key in secret_keys}

print(
    json.dumps(
        {
            "env": "\n".join(f"{k}={merged_env[k]}" for k in merged_env),
            "public_env": "\n".join(f"{k}={public_env[k]}" for k in public_env),
            "secret_env": "\n".join(f"{k}={secret_env[k]}" for k in secret_env),
        }
    )
)
PY
    EOT
  ]
}

output "env" {
  description = "Full generated environment payload for the selected platform."
  value       = data.external.generated_env.result.env
  sensitive   = true
}

output "public_env" {
  description = "Generated non-secret environment payload for the selected platform."
  value       = data.external.generated_env.result.public_env
  sensitive   = false
}

output "secret_env" {
  description = "Generated secret environment payload for the selected platform, derived from secrets.enc.json."
  value       = data.external.generated_env.result.secret_env
  sensitive   = true
}
