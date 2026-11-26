
variable "config_dir" {
  description = "Required path to the deployment config directory containing core.json, do.json, and optional secrets.enc.json"
  type        = string
}

variable "do_token" {
  description = "digital ocean access token"
  type        = string
  sensitive   = true
  validation {
    condition     = trimspace(var.do_token) != "" && !contains(["x", "changeme", "replace-me"], lower(trimspace(var.do_token)))
    error_message = "do_token must be set to a non-placeholder value."
  }
}
variable "registry_credentials" {
  description = "Github registry credentials for pulling private images"
  type        = any
  sensitive   = true
  default     = null
}

module "deployment" {
  source               = "../modules/deployment"
  config_dir           = var.config_dir
  do_token             = var.do_token
  registry_credentials = var.registry_credentials
}

output "generated_api_public_env" {
  value = module.deployment.generated_api_public_env
}

output "generated_apps_public_env" {
  value = module.deployment.generated_apps_public_env
}

output "generated_api_secret_env_keys" {
  value = module.deployment.generated_api_secret_env_keys
}

output "generated_apps_secret_env_keys" {
  value = module.deployment.generated_apps_secret_env_keys
}

output "couchdb_backup_timer_configuration" {
  value = module.deployment.couchdb_backup_timer_configuration
}

