
module "couchdb" {
  source              = "../modules/couchdb"
  subdomain           = var.subdomain
  local_ini_b64       = base64encode(file("./assets/local.ini"))
  couchdb_env_b64     = filebase64("./fieldmark.env")
  do_token            = var.do_token
  authorized_key      = file("./assets/public_key.pub")
  region              = "syd1"
  droplet_size        = "s-2vcpu-4gb-intel"
  couchdb_volume_size = 400
  instance_count      = 1
  backup_env_b64      = base64encode(file("./assets/backup.env"))
}

module "apps" {
  source = "../modules/webapps"

  subdomain     = "fieldmark.app"
  env_b64       = filebase64("./fieldmark.env")
  do_token      = var.do_token
  region        = "syd"
  contact_email = var.contact_email
}

module "api" {
  source                     = "../modules/api"
  subdomain                  = var.subdomain
  contact_email              = var.contact_email
  do_token                   = var.do_token
  conductor_env_b64          = filebase64("./fieldmark.env")
  conductor_pub_key_b64      = filebase64("./assets/public_key.pem")
  conductor_pvt_key_b64      = filebase64("./assets/private_key.pem")
  authorized_key             = file("./assets/public_key.pub")
  region                     = "syd1"
  instance_size              = "basic-m"
  couchdb_password           = var.couchdb_password
  cookie_secret              = var.cookie_secret
  smtp_password              = var.smtp_password
  registry_credentials       = var.registry_credentials
  auth_providers             = var.auth_providers
  conductor_docker_image_tag = var.conductor_docker_image_tag
}

module "documentation" {
  source              = "../modules/documentation"
  subdomain           = var.subdomain
  env_b64             = filebase64("./fieldmark.env")
  do_token            = var.do_token
  region              = "syd1"
  docs_source_dir     = "docs"
  docs_output_dir     = "user/_build/html"
  docs_build_command  = "cd user && make html"
  docs_deploy_on_push = false
}

variable "do_token" {
  description = "digital ocean access token"
  type        = string
  validation {
    condition     = trimspace(var.do_token) != "" && !contains(["x", "changeme", "replace-me"], lower(trimspace(var.do_token)))
    error_message = "do_token must be set to a non-placeholder value."
  }
}
variable "contact_email" {
  description = "contact email for Lets Encrypt SSL certificate"
  type        = string
  validation {
    condition     = trimspace(var.contact_email) != "" && can(regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", var.contact_email))
    error_message = "contact_email must be a valid email address."
  }
}
variable "subdomain" {
  description = "subdomain for the site"
  type        = string
  validation {
    condition     = trimspace(var.subdomain) != "" && can(regex("^[a-zA-Z0-9]([a-zA-Z0-9-]*\\.)+[a-zA-Z]{2,}$", var.subdomain))
    error_message = "subdomain must be a non-empty FQDN-style hostname."
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

# Secrets
variable "couchdb_password" {
  description = "Password for CouchDB admin user"
  type        = string
  sensitive   = true
  validation {
    condition     = trimspace(var.couchdb_password) != "" && !contains(["x", "changeme", "replace-me"], lower(trimspace(var.couchdb_password)))
    error_message = "couchdb_password must be set to a non-placeholder value."
  }
}
variable "cookie_secret" {
  description = "Secret for signing cookies"
  type        = string
  sensitive   = true
  validation {
    condition     = trimspace(var.cookie_secret) != "" && !contains(["x", "changeme", "replace-me"], lower(trimspace(var.cookie_secret)))
    error_message = "cookie_secret must be set to a non-placeholder value."
  }
}
variable "smtp_password" {
  description = "Password for SMTP email sending"
  type        = string
  sensitive   = true
  validation {
    condition     = trimspace(var.smtp_password) != "" && !contains(["x", "changeme", "replace-me"], lower(trimspace(var.smtp_password)))
    error_message = "smtp_password must be set to a non-placeholder value."
  }
}
variable "registry_credentials" {
  description = "Github registry credentials for pulling private images"
  type        = any
}

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
