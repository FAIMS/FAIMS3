variable "instance_count" {
  description = "Number of couchdb instances to provision."
  type        = number
  default     = 1
}

variable "subdomain" {
  description = "Subdomain for this deployment, eg. testing.fieldmark.app"
  type = string
}
