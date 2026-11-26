variable "do_token" {
  description = "digital ocean access token"
  type        = string
  sensitive   = true
  validation {
    condition     = trimspace(var.do_token) != "" && !contains(["x", "changeme", "replace-me"], lower(trimspace(var.do_token)))
    error_message = "do_token must be set to a non-placeholder value."
  }
}
variable "deployment_domain" {
  description = "Base domain used to identify this deployment"
  type        = string
  validation {
    condition     = trimspace(var.deployment_domain) != "" && can(regex("^[a-zA-Z0-9]([a-zA-Z0-9-]*\\.)+[a-zA-Z]{2,}$", var.deployment_domain))
    error_message = "deployment_domain must be a non-empty FQDN-style hostname."
  }
}
variable "api_domain" {
  description = "Full public domain for the API service"
  type        = string
  validation {
    condition     = trimspace(var.api_domain) != "" && can(regex("^[a-zA-Z0-9]([a-zA-Z0-9-]*\\.)+[a-zA-Z]{2,}$", var.api_domain))
    error_message = "api_domain must be a non-empty FQDN-style hostname."
  }
}
variable "couchdb_public_url" {
  description = "Public HTTPS URL of the load-balanced CouchDB endpoint"
  type        = string
  validation {
    condition     = startswith(var.couchdb_public_url, "https://") && can(regex("^https://[a-zA-Z0-9]([a-zA-Z0-9-]*\\.)+[a-zA-Z]{2,}$", var.couchdb_public_url))
    error_message = "couchdb_public_url must be an HTTPS FQDN URL."
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
variable "conductor_registry_type" {
  description = "DigitalOcean App Platform registry type"
  type        = string
  default     = "GHCR"
  validation {
    condition     = contains(["GHCR", "DOCR", "DOCKER_HUB"], var.conductor_registry_type)
    error_message = "conductor_registry_type must be GHCR, DOCR, or DOCKER_HUB."
  }
}
variable "conductor_registry" {
  description = "Container registry or GitHub organization"
  type        = string
  default     = "faims"
}
variable "conductor_repository" {
  description = "Container image repository"
  type        = string
  default     = "faims3-api"
  validation {
    condition     = trimspace(var.conductor_repository) != ""
    error_message = "conductor_repository must be non-empty."
  }
}
variable "conductor_env_b64" {
  description = "base64 encoded non-secret environment payload for conductor deployment"
  type        = string
}
variable "conductor_secret_env_b64" {
  description = "base64 encoded secret environment payload for conductor deployment"
  type        = string
  sensitive   = true
}
variable "signing_private_key" {
  description = "Base64-encoded PKCS#8 private signing key"
  type        = string
  sensitive   = true
  validation {
    condition     = trimspace(var.signing_private_key) != ""
    error_message = "signing_private_key must be supplied from do-secrets.enc.json."
  }
}
variable "signing_public_key" {
  description = "Base64-encoded SPKI public signing key"
  type        = string
  sensitive   = true
  validation {
    condition     = trimspace(var.signing_public_key) != ""
    error_message = "signing_public_key must be supplied from do-secrets.enc.json."
  }
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

variable "registry_credentials" {
  description = "Github registry credentials for pulling private images"
  type        = any
  sensitive   = true
}
