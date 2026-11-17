variable "do_token" {
  description = "digital ocean access token"
  type = string
}

variable "region" {
  description = "Region to deploy to"
  type = string
  default = "syd1"
}

variable "subdomain" {
  description = "Subdomain for this deployment, eg. testing.fieldmark.app"
  type = string
}

variable "env_b64" {
  description = "Base64 encoded version of .env for conductor and couchdb containing COUCHDB_PASSWORD"
}

variable "contact_email" {
  description = "Contact email address for Let's Encrypt SSL certificate"
  type = string
}
