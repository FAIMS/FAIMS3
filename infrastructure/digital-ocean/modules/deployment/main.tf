locals {
  config_core = jsondecode(file("${var.config_dir}/core.json"))
  do_config   = jsondecode(file("${var.config_dir}/do.json"))

  contact_email = try(local.config_core.support.supportEmail, try(local.do_config.contact_email, "support@example.com"))
  base_domain   = local.config_core.domains.base
  api_domain    = "${local.config_core.domains.services.conductor}.${local.base_domain}"
  app_domain    = "${local.config_core.domains.services.app}.${local.base_domain}"
  couch_domain  = "${local.config_core.domains.services.couch}.${local.base_domain}"
  docs_domain   = "${local.config_core.domains.services.docs}.${local.base_domain}"
  web_domain    = "${local.config_core.domains.services.web}.${local.base_domain}"
  region        = try(local.do_config.region, "syd1")

  conductor_image_tag = try(local.do_config.conductor.imageTag, "replace-with-pinned-tag")
  conductor_size      = try(local.do_config.conductor.instanceSize, "basic-m")
  couch_droplet_size  = try(local.do_config.couch.dropletSize, "s-2vcpu-4gb-intel")
  couch_volume_size   = try(local.do_config.couch.volumeSize, 400)

  generated_api_env  = module.config_api.env
  generated_apps_env = module.config_apps.env

  api_env_map = {
    for line in split("\n", local.generated_api_env) :
    split("=", line)[0] => join("=", slice(split("=", line), 1, length(split("=", line))))
    if length(split("=", line)) >= 2 && !startswith(line, "#") && trimspace(line) != ""
  }

  api_public_env_map = {
    for line in split("\n", module.config_api.public_env) :
    split("=", line)[0] => join("=", slice(split("=", line), 1, length(split("=", line))))
    if length(split("=", line)) >= 2 && trimspace(line) != ""
  }

  apps_public_env_map = {
    for line in split("\n", module.config_apps.public_env) :
    split("=", line)[0] => join("=", slice(split("=", line), 1, length(split("=", line))))
    if length(split("=", line)) >= 2 && trimspace(line) != ""
  }
}

module "config_api" {
  source     = "../config"
  config_dir = var.config_dir
  platform   = "api"
}

module "config_apps" {
  source     = "../config"
  config_dir = var.config_dir
  platform   = "apps"
}

module "do_secrets" {
  source     = "../do-secrets"
  config_dir = var.config_dir
}

module "couchdb" {
  source                   = "../couchdb"
  deployment_domain        = local.base_domain
  couch_domain             = local.couch_domain
  cookie_secret            = try(local.api_env_map.FAIMS_COOKIE_SECRET, "")
  backup_endpoint          = local.do_config.backup.endpoint
  backup_bucket            = local.do_config.backup.bucket
  backup_access_key_id     = module.do_secrets.backup_access_key_id
  backup_secret_access_key = module.do_secrets.backup_secret_access_key
  restic_password          = module.do_secrets.restic_password
  do_token                 = var.do_token
  region                   = local.region
  droplet_size             = local.couch_droplet_size
  couchdb_volume_size      = local.couch_volume_size
  instance_count           = try(local.do_config.couch.instanceCount, 1)
}

module "apps" {
  source = "../webapps"

  deployment_domain = local.base_domain
  app_domain        = local.app_domain
  web_domain        = local.web_domain
  env_b64           = base64encode(local.generated_apps_env)
  do_token          = var.do_token
  region            = local.region
  contact_email     = local.contact_email
}

module "api" {
  source                     = "../api"
  deployment_domain          = local.base_domain
  api_domain                 = local.api_domain
  contact_email              = local.contact_email
  do_token                   = var.do_token
  conductor_env_b64          = base64encode(module.config_api.public_env)
  conductor_secret_env_b64   = base64encode(module.config_api.secret_env)
  region                     = local.region
  instance_size              = local.conductor_size
  registry_credentials       = var.registry_credentials
  conductor_docker_image_tag = local.conductor_image_tag
}

module "documentation" {
  source              = "../documentation"
  deployment_domain   = local.base_domain
  docs_domain         = local.docs_domain
  env_b64             = base64encode(local.generated_apps_env)
  do_token            = var.do_token
  region              = local.region
  docs_source_dir     = "docs"
  docs_output_dir     = "user/_build/html"
  docs_build_command  = "cd user && make html"
  docs_deploy_on_push = false
}
