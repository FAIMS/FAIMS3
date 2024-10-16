variable "instance_count" {
  description = "Number of couchdb instances to provision."
  type        = number
  default     = 1
}

variable "subdomain" {
  description = "Subdomain for this deployment, eg. testing.fieldmark.app"
  type = string
}

variable "local_ini_b64" {
  description = "Base64 encoded version of the local.ini file for couchdb"
  type = string
}