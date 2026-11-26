variable "config_dir" {
  description = "Deployment environment directory containing core.json, do.json, and optional secrets.enc.json"
  type        = string
}

variable "do_token" {
  description = "DigitalOcean API token"
  type        = string
  sensitive   = true
}

variable "registry_credentials" {
  description = "Container registry credentials for pulling private images"
  type        = any
  sensitive   = true
  default     = null
}
