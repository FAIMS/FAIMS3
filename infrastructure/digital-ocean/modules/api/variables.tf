variable "do_token" {
  description = "digital ocean access token"
  type        = string
  validation {
    condition     = trimspace(var.do_token) != "" && !contains(["x", "changeme", "replace-me"], lower(trimspace(var.do_token)))
    error_message = "do_token must be set to a non-placeholder value."
  }
}
variable "subdomain" {
  description = "Subdomain for this deployment, eg. testing.fieldmark.app"
  type        = string
  validation {
    condition     = trimspace(var.subdomain) != "" && can(regex("^[a-zA-Z0-9]([a-zA-Z0-9-]*\\.)+[a-zA-Z]{2,}$", var.subdomain))
    error_message = "subdomain must be a non-empty FQDN-style hostname."
  }
}
variable "contact_email" {
  description = "Contact email address for Let's Encrypt SSL certificate"
  type        = string
  validation {
    condition     = trimspace(var.contact_email) != "" && can(regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", var.contact_email))
    error_message = "contact_email must be a valid email address."
  }
}
variable "conductor_docker_image_tag" {
  description = "Tag of the Conductor API Docker image to deploy"
  type        = string
  validation {
    condition     = trimspace(var.conductor_docker_image_tag) != "" && lower(trimspace(var.conductor_docker_image_tag)) != "latest" && !contains(["x", "changeme", "replace-me"], lower(trimspace(var.conductor_docker_image_tag)))
    error_message = "conductor_docker_image_tag must be explicitly pinned and cannot be latest or a placeholder value."
  }
}
variable "conductor_env_b64" {
  description = "base64 encoded version of the .env file for conductor deployment"
  type        = string
}
variable "conductor_pvt_key_b64" {
  description = "base64 encoded content of private key file for conductor deployment"
  type        = string
}
variable "conductor_pub_key_b64" {
  description = "base64 encoded content of public key file for conductor deployment"
  type        = string
}
variable "authorized_key" {
  description = "public key for ssh login, added to authorized_keys"
  type        = string
}
variable "region" {
  description = "Region to deploy to"
  type        = string
  default     = "syd1"
  validation {
    condition     = contains(["syd1", "sfo3", "nyc1", "nyc3", "fra1", "lon1", "ams3", "sgp1", "tor1", "blr1"], var.region)
    error_message = "region must be an approved DigitalOcean region slug."
  }
}

variable "instance_size" {
  description = "Size of the instance to provision for conductor"
  type        = string
  default     = "s-1vcpu-1gb"
  validation {
    condition     = trimspace(var.instance_size) != ""
    error_message = "instance_size must be non-empty."
  }
}

## Authentication Providers

variable "auth_providers" {
  description = "Configuration for authentication providers"
  type = map(object({
    type          = string
    index         = number
    display_name  = string
    helper_text   = string
    client_id     = string
    client_secret = string
    scope         = string
    # OIDC-specific fields (optional)
    issuer            = optional(string)
    authorization_url = optional(string)
    token_url         = optional(string)
    user_info_url     = optional(string)
  }))
  sensitive = true
  default   = {}
}

## Secrets
variable "couchdb_password" {
  description = "Password for CouchDB admin user"
  type        = string
  sensitive   = true
}
variable "cookie_secret" {
  description = "Secret for signing cookies"
  type        = string
  sensitive   = true
}
variable "smtp_password" {
  description = "Password for SMTP email sending"
  type        = string
  sensitive   = true
}
variable "registry_credentials" {
  description = "Github registry credentials for pulling private images"
  type        = any
}
