
module "couchdb" {
  source = "../couchdb"

  subdomain = "demo.fieldmark.app"
  local_ini_b64 = base64encode(file("./assets/local.ini"))
  couchdb_env_b64 = filebase64("./conductor.env")
  do_token = var.do_token
  authorized_key = file("./assets/public_key.pub")
}

module "conductor" {
  source = "../conductor"
  subdomain = "demo.fieldmark.app"
  contact_email = "steve@fieldnote.au"
  do_token = var.do_token
  conductor_env_b64 = filebase64("./conductor.env")
  conductor_pub_key_b64 = filebase64("./assets/public_key.pem")
  conductor_pvt_key_b64 = filebase64("./assets/private_key.pem")
  authorized_key = file("./assets/public_key.pub")
}

variable "do_token" {
  description = "digital ocean access token"
  type = string
}

