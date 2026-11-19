terraform {
  required_providers {
    external = {
      source  = "hashicorp/external"
      version = ">= 2.3.0"
    }
  }
}

variable "config_dir" {
  description = "Deployment environment directory containing do-secrets.enc.json"
  type        = string
}

locals {
  config_dir   = abspath(var.config_dir)
  secrets_file = abspath("${var.config_dir}/do-secrets.enc.json")
}

data "external" "do_secrets" {
  program = [
    "bash",
    "-lc",
    <<-EOT
      set -euo pipefail
      secrets_file='${local.secrets_file}'
      if [[ ! -f "$secrets_file" ]]; then
        echo "Missing required $secrets_file" >&2
        exit 1
      fi
      if [[ -z "$${SOPS_AGE_KEY:-}" && -z "$${SOPS_AGE_KEY_FILE:-}" ]]; then
        echo "$secrets_file is encrypted but SOPS_AGE_KEY / SOPS_AGE_KEY_FILE is not set." >&2
        exit 1
      fi

      sops --decrypt "$secrets_file" | pnpm --silent \
        --filter=@faims3/infra-digital-ocean \
        run validate-config -- \
        --config-dir "${local.config_dir}" \
        --secrets - \
        --format terraform-json
    EOT
  ]
}

output "backup_access_key_id" {
  value     = data.external.do_secrets.result.access_key_id
  sensitive = true
}

output "backup_secret_access_key" {
  value     = data.external.do_secrets.result.secret_access_key
  sensitive = true
}

output "restic_password" {
  value     = data.external.do_secrets.result.restic_password
  sensitive = true
}
