variable "do_token" {
  description = "digital ocean access token"
  type        = string
}

variable "region" {
  description = "Region to deploy to"
  type        = string
  default     = "syd1"
}

variable "droplet_size" {
  description = "Size of the droplet to provision for couchdb"
  type        = string
  default     = "s-1vcpu-1gb"
}

variable "couchdb_volume_size" {
  description = "Size of the volume to attach to the couchdb droplet"
  type        = number
  default     = 100
  validation {
    condition     = var.couchdb_volume_size > 0
    error_message = "couchdb_volume_size must be greater than zero."
  }
}

variable "couchdb_volume_snapshot_id" {
  description = "Optional DigitalOcean volume snapshot ID used to restore CouchDB data"
  type        = string
  default     = ""
}

variable "instance_count" {
  description = "Number of couchdb instances to provision."
  type        = number
  default     = 1
  validation {
    condition     = var.instance_count == 1
    error_message = "The DigitalOcean CouchDB module currently supports exactly one instance; clustering is not implemented."
  }
}

variable "deployment_domain" {
  description = "Base domain used to identify this deployment"
  type        = string
}

variable "couch_domain" {
  description = "Full public domain for CouchDB"
  type        = string
}

variable "cookie_secret" {
  description = "Secret used for CouchDB cookie authentication"
  type        = string
  sensitive   = true
  validation {
    condition     = trimspace(var.cookie_secret) != ""
    error_message = "cookie_secret must be supplied."
  }
}

variable "couchdb_user" {
  description = "CouchDB admin user"
  type        = string
  validation {
    condition     = trimspace(var.couchdb_user) != ""
    error_message = "couchdb_user must be supplied."
  }
}

variable "couchdb_password" {
  description = "CouchDB admin password"
  type        = string
  sensitive   = true
  validation {
    condition     = trimspace(var.couchdb_password) != ""
    error_message = "couchdb_password must be supplied."
  }
}

variable "backup_endpoint" {
  description = "S3-compatible endpoint used by the restic backup repository"
  type        = string
}

variable "backup_bucket" {
  description = "S3-compatible bucket used by the restic backup repository"
  type        = string
}

variable "backup_access_key_id" {
  description = "Access key ID used by the restic backup repository"
  type        = string
  sensitive   = true
  default     = ""
  validation {
    condition     = trimspace(var.backup_access_key_id) != ""
    error_message = "backup_access_key_id must be supplied from secrets.enc.json."
  }
}

variable "backup_secret_access_key" {
  description = "Secret access key used by the restic backup repository"
  type        = string
  sensitive   = true
  default     = ""
  validation {
    condition     = trimspace(var.backup_secret_access_key) != ""
    error_message = "backup_secret_access_key must be supplied from secrets.enc.json."
  }
}

variable "restic_password" {
  description = "Restic repository encryption password"
  type        = string
  sensitive   = true
  default     = ""
  validation {
    condition     = trimspace(var.restic_password) != ""
    error_message = "restic_password must be supplied."
  }
}
