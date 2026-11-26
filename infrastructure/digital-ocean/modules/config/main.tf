terraform {
  required_providers {
    external = {
      source  = "hashicorp/external"
      version = ">= 2.3.0"
    }
  }
}

variable "config_dir" {
  description = "Path to the deployment config directory containing core.json and optional secrets.enc.json."
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

# Build config is generated from core.json, with optional SOPS
# decryption of secrets.enc.json. The decrypted overlay is also used to split
# generated env into secret and non-secret sets without hardcoding key allowlists.

data "external" "generated_env" {
  program = [
    "bash",
    "-lc",
    <<-EOT
      set -euo pipefail
      cd "${path.module}/../../../../"

      python3 - "${local.config_dir}" <<'PY'
import json
import os
import pathlib
import subprocess
import sys

config_dir = pathlib.Path(sys.argv[1])

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

def mask_overlay_strings(target, overlay, sentinel):
    if isinstance(overlay, dict) and isinstance(target, dict):
        out = dict(target)
        for key, overlay_value in overlay.items():
            if key in target:
                out[key] = mask_overlay_strings(
                    target[key], overlay_value, sentinel
                )
        return out
    if isinstance(overlay, list) and isinstance(target, list):
        return [
            sentinel if isinstance(overlay_value, str) else overlay_value
            for overlay_value in overlay
        ]
    if isinstance(overlay, str):
        return sentinel
    return target

base_path = config_dir / 'core.json'
base = json.loads(base_path.read_text())
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
    decrypted = subprocess.run(
        ['sops', '--decrypt', str(secrets_enc_path)],
        text=True,
        capture_output=True,
    )
    if decrypted.returncode != 0:
        message = decrypted.stderr.strip() or f"sops exited with status {decrypted.returncode}"
        raise SystemExit(f"Failed to decrypt {secrets_enc_path} with sops: {message}")
    secrets_cfg = json.loads(decrypted.stdout)
    merged = deep_merge(merged, secrets_cfg)

def generate_env(config_path=None, config=None):
    command = [
        'pnpm',
        '--silent',
        '--filter=@faims3/build-config',
        'run',
        'generate',
        '--',
        '--config',
        str(config_path) if config_path is not None else '-',
        '--platform',
        '${var.platform}',
    ]
    generated = subprocess.run(
        command,
        input=json.dumps(config) if config is not None else None,
        text=True,
        capture_output=True,
    )
    if generated.returncode != 0:
        message = generated.stderr.strip() or f"pnpm exited with status {generated.returncode}"
        raise SystemExit(f"Failed to generate build config: {message}")
    return generated.stdout

def parse_env(text):
    env = {}
    for line in text.splitlines():
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        env[key] = value
    return env

merged_env = (
    parse_env(generate_env(config=merged))
    if has_secrets_overlay
    else parse_env(generate_env(config_path=base_path))
)

secret_keys = []
if has_secrets_overlay:
    # Mask secret overlay strings and compare env after parsing the complete
    # merged config. This avoids validating core.json before its secret overlay
    # supplies values required by the build-config invariants.
    masked = mask_overlay_strings(merged, secrets_cfg, '<SOPS_SECRET_REDACTED>')
    masked_env = parse_env(generate_env(config=masked))
    for key, value in merged_env.items():
        if masked_env.get(key) != value:
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
            "secret_env_keys": ",".join(sorted(secret_env)),
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

output "secret_env_keys" {
  description = "Names of generated environment values derived from secrets.enc.json."
  value       = compact(split(",", data.external.generated_env.result.secret_env_keys))
}
