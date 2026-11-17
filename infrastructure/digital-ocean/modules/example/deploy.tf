
module "couchdb" {
  # in a separate git repo, refer to the module like this
  # source = "git@github.com:FAIMS/FAIMS3.git//infrastructure/digital-ocean/couchdb"
  # here we use a local reference
  source = "../couchdb"

  subdomain = "demo.fieldmark.app"
  local_ini_b64 = base64encode(file("./assets/local.ini"))
  couchdb_env_b64 = filebase64("./conductor.env")
  do_token = var.do_token
  authorized_key = file("./assets/public_key.pub")
  region = "syd1"
  droplet_size = "s-1vcpu-1gb"
  couchdb_volume_size = 100
}

module "conductor" {
  # source = "git@github.com:FAIMS/FAIMS3.git//infrastructure/digital-ocean/conductor"
  source = "../conductor"
  subdomain = "demo.fieldmark.app"
  contact_email = var.contact_email
  do_token = var.do_token
  conductor_env_b64 = filebase64("./conductor.env")
  conductor_pub_key_b64 = filebase64("./assets/public_key.pem")
  conductor_pvt_key_b64 = filebase64("./assets/private_key.pem")
  authorized_key = file("./assets/public_key.pub")
  region = "syd1"
  droplet_size = "s-1vcpu-1gb"
}

variable "do_token" {
  description = "digital ocean access token"
  type = string
}
variable "contact_email" {
  description = "contact email for Lets Encrypt SSL certificate"
  type = string
}
