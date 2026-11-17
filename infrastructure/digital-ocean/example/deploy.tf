
variable "config_dir" {
  description = "Required path to the deployment config directory containing core.json, do.json, and optional secrets.enc.json."
  type        = string
}

locals {
  config_core = jsondecode(file("${var.config_dir}/core.json"))
  do_config   = jsondecode(file("${var.config_dir}/do.json"))

  contact_email = try(local.config_core.support.supportEmail, try(local.do_config.contact_email, "support@example.com"))
  base_domain   = try(local.do_config.baseDomain, "example.com")
  region        = try(local.do_config.region, "syd1")

  conductor_image_tag = try(local.do_config.conductor.imageTag, "replace-with-pinned-tag")
  conductor_size      = try(local.do_config.conductor.instanceSize, "basic-m")
  couch_droplet_size  = try(local.do_config.couch.dropletSize, "s-2vcpu-4gb-intel")
  couch_volume_size   = try(local.do_config.couch.volumeSize, 400)

  generated_local_ini = <<-EOT
; CouchDB Configuration Settings for FAIMS

[couchdb]
max_document_size = 4294967296
os_process_timeout = 5000
uuid = ${try(local.api_env_map.FAIMS_COOKIE_SECRET, "")}
database_dir = /mnt/couchdb/data
view_index_dir = /mnt/couchdb/data

[chttpd]
port = 5984
bind_address = 0.0.0.0
authentication_handlers = {chttpd_auth, cookie_authentication_handler}, {chttpd_auth, jwt_authentication_handler}, {chttpd_auth, default_authentication_handler}

[httpd]
enable_cors = true

[couchdb]
single_node=true

[log]
writer = syslog
level = info

[chttpd_auth]
secret = ${try(local.api_env_map.FAIMS_COOKIE_SECRET, "")}

[cors]
origins = *
headers = accept, authorization, content-type, origin, referer
credentials = true
methods = GET, PUT, POST, HEAD, DELETE
EOT

  generated_backup_env = <<-EOT
COUCHDB_DATA_DIR=/mnt/couchdb/data
DO_SPACES_ENDPOINT=${try(local.do_config.storage.endpoint, "https://syd1.digitaloceanspaces.com")}
DO_SPACES_BUCKET=${try(local.do_config.storage.bucket, "fieldmark-example-backups")}
AWS_ACCESS_KEY_ID=replace-with-spaces-key
AWS_SECRET_ACCESS_KEY=replace-with-spaces-secret
RESTIC_PASSWORD=${try(local.api_env_map.FAIMS_COOKIE_SECRET, "")}
KEEP_DAILY=7
KEEP_WEEKLY=4
KEEP_MONTHLY=12
BACKUP_TAG=couchdb-backup
LOG_DIR=/var/log/couchdb-backup
NOTIFY_EMAIL=
NOTIFY_WEBHOOK=
EOT

  generated_authorized_key = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCplaceholder user@example.com"

  generated_api_env  = module.config_api.env
  generated_apps_env = module.config_apps.env
  api_env_map = {
    for line in split("\n", local.generated_api_env) :
    split("=", line)[0] => join("=", slice(split("=", line), 1, length(split("=", line))))
    if length(split("=", line)) >= 2 && !startswith(line, "#") && trimspace(line) != ""
  }
}

module "config_api" {
  source     = "../modules/config"
  config_dir = var.config_dir
  platform   = "api"
}

module "config_apps" {
  source     = "../modules/config"
  config_dir = var.config_dir
  platform   = "apps"
}

module "couchdb" {
  source              = "../modules/couchdb"
  subdomain           = local.base_domain
  local_ini_b64       = base64encode(local.generated_local_ini)
  couchdb_env_b64     = base64encode(local.generated_api_env)
  do_token            = var.do_token
  authorized_key      = local.generated_authorized_key
  region              = local.region
  droplet_size        = local.couch_droplet_size
  couchdb_volume_size = local.couch_volume_size
  instance_count      = try(local.do_config.couch.instanceCount, 1)
  backup_env_b64      = base64encode(local.generated_backup_env)
}

module "apps" {
  source = "../modules/webapps"

  subdomain     = local.base_domain
  env_b64       = base64encode(local.generated_apps_env)
  do_token      = var.do_token
  region        = local.region
  contact_email = local.contact_email
}

module "api" {
  source                     = "../modules/api"
  subdomain                  = local.base_domain
  contact_email              = local.contact_email
  do_token                   = var.do_token
  conductor_env_b64          = base64encode(module.config_api.public_env)
  conductor_secret_env_b64   = base64encode(module.config_api.secret_env)
  authorized_key             = local.generated_authorized_key
  region                     = local.region
  instance_size              = local.conductor_size
  registry_credentials       = var.registry_credentials
  conductor_docker_image_tag = local.conductor_image_tag
}

module "documentation" {
  source              = "../modules/documentation"
  subdomain           = local.base_domain
  env_b64             = base64encode(local.generated_apps_env)
  do_token            = var.do_token
  region              = local.region
  docs_source_dir     = "docs"
  docs_output_dir     = "user/_build/html"
  docs_build_command  = "cd user && make html"
  docs_deploy_on_push = false
}

variable "do_token" {
  description = "digital ocean access token"
  type        = string
  validation {
    condition     = trimspace(var.do_token) != "" && !contains(["x", "changeme", "replace-me"], lower(trimspace(var.do_token)))
    error_message = "do_token must be set to a non-placeholder value."
  }
}
variable "registry_credentials" {
  description = "Github registry credentials for pulling private images"
  type        = any
}

