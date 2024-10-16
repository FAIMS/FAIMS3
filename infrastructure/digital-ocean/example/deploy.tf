
module "couchdb" {
  source = "../couchdb"

  subdomain = "demo.fieldmark.app"

  local_ini_b64 = base64encode(file("../../../api/couchdb/local.ini"))
  
  do_token = var.do_token
  pvt_key = var.pvt_key
}