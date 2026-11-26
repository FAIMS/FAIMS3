output "generated_api_public_env" {
  description = "Generated API environment values that do not originate from secrets.enc.json"
  value       = local.api_public_env_map
}

output "generated_apps_public_env" {
  description = "Generated app and web environment values that do not originate from secrets.enc.json"
  value       = local.apps_public_env_map
}

output "generated_api_secret_env_keys" {
  description = "Names of API environment values sourced from secrets.enc.json"
  value       = module.config_api.secret_env_keys
}

output "generated_apps_secret_env_keys" {
  description = "Names of app and web environment values sourced from secrets.enc.json"
  value       = module.config_apps.secret_env_keys
}

output "couchdb_backup_timer_configuration" {
  description = "Effective non-secret CouchDB backup timer and retention configuration"
  value       = module.couchdb.backup_timer_configuration
}
