variable "do_token" {
  description = "digital ocean access token"
  type = string
}

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
variable "couchdb_env_b64" {
  description = "Base64 encoded version of .env for couchdb containing COUCHDB_PASSWORD"
}
variable "authorized_key" {
  description = "public key for ssh login, added to authorized_keys"
  type = string
}