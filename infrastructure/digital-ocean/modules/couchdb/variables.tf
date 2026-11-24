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

variable "droplet_image" {
  description = "DigitalOcean image slug or ID for the CouchDB droplet"
  type        = string

  validation {
    condition     = trimspace(var.droplet_image) != ""
    error_message = "droplet_image must be non-empty."
  }
}

variable "couchdb_version" {
  description = "CouchDB semantic version to install, for example 3.5.3"
  type        = string

  validation {
    condition     = can(regex("^\\d+\\.\\d+\\.\\d+$", var.couchdb_version))
    error_message = "couchdb_version must be a semantic version such as 3.5.3."
  }
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

variable "deployment_domain" {
  description = "Base domain used to identify this deployment"
  type        = string
}

variable "couch_domain" {
  description = "Full public domain for CouchDB"
  type        = string
}

variable "admin_ssh_cidrs" {
  description = "Optional CIDR blocks allowed to SSH to CouchDB droplets; leave empty to disable public SSH ingress"
  type        = list(string)
  default     = []
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

variable "backup_on_calendar" {
  description = "Systemd OnCalendar schedule for CouchDB backups (UTC)"
  type        = string
  default     = "daily"
  validation {
    condition     = trimspace(var.backup_on_calendar) != ""
    error_message = "backup_on_calendar must be non-empty."
  }
}

variable "backup_randomized_delay_sec" {
  description = "Maximum randomized delay in seconds applied by the backup timer"
  type        = number
  default     = 900
  validation {
    condition     = var.backup_randomized_delay_sec >= 0
    error_message = "backup_randomized_delay_sec must be zero or positive."
  }
}

variable "backup_keep_daily" {
  description = "Daily restic snapshots to retain"
  type        = number
  default     = 7
  validation {
    condition     = var.backup_keep_daily > 0
    error_message = "backup_keep_daily must be greater than zero."
  }
}

variable "backup_keep_weekly" {
  description = "Weekly restic snapshots to retain"
  type        = number
  default     = 4
  validation {
    condition     = var.backup_keep_weekly > 0
    error_message = "backup_keep_weekly must be greater than zero."
  }
}

variable "backup_keep_monthly" {
  description = "Monthly restic snapshots to retain"
  type        = number
  default     = 12
  validation {
    condition     = var.backup_keep_monthly > 0
    error_message = "backup_keep_monthly must be greater than zero."
  }
}

variable "backup_tag" {
  description = "Restic tag used for CouchDB backup snapshots"
  type        = string
  default     = "couchdb-backup"
  validation {
    condition     = trimspace(var.backup_tag) != ""
    error_message = "backup_tag must be non-empty."
  }
}

variable "backup_log_dir" {
  description = "Directory used to store CouchDB backup logs"
  type        = string
  default     = "/var/log/couchdb-backup"
  validation {
    condition     = trimspace(var.backup_log_dir) != ""
    error_message = "backup_log_dir must be non-empty."
  }
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
