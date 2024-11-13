variable "do_token" {
  description = "digital ocean access token"
  type = string
}
variable "subdomain" {
  description = "Subdomain for this deployment, eg. testing.fieldmark.app"
  type = string
}
variable "contact_email" {
  description = "Contact email address for Let's Encrypt SSL certificate"
  type = string
}
variable "conductor_env_b64" {
  description = "base64 encoded version of the .env file for conductor deployment"
  type = string
}
variable "conductor_pvt_key_b64" {
  description = "base64 encoded content of private key file for conductor deployment"
  type = string
}
variable "conductor_pub_key_b64" {
  description = "base64 encoded content of public key file for conductor deployment"
  type = string
}
variable "authorized_key" {
  description = "public key for ssh login, added to authorized_keys"
  type = string
}
