variable "subdomain" {
  description = "Subdomain for this deployment, eg. testing.fieldmark.app"
  type = string
}
variable "contact_email" {
  description = "Contact email address for Let's Encrypt SSL certificate"
  type = string
}