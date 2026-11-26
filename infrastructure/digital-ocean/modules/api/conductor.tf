locals {
  # Read environment variables from base64 encoded file
  generated_env = { for line in split("\n", base64decode(var.conductor_env_b64)) :
    split("=", line)[0] => join("=", slice(split("=", line), 1, length(split("=", line))))
    if length(split("=", line)) >= 2 && !startswith(line, "#") && line != ""
  }
  generated_secret_env = { for line in split("\n", base64decode(var.conductor_secret_env_b64)) :
    split("=", line)[0] => join("=", slice(split("=", line), 1, length(split("=", line))))
    if length(split("=", line)) >= 2 && !startswith(line, "#") && line != ""
  }
  env = merge(local.generated_env, {
    # always use the ENV source for signing keys
    KEY_SOURCE = "ENV"
    # we use the public URL to connect with CouchDB through the load balancer
    COUCHDB_INTERNAL_URL    = var.couchdb_public_url
    COUCHDB_PUBLIC_URL      = var.couchdb_public_url
    COUCHDB_EXTERNAL_PORT   = "443"
    CONDUCTOR_EXTERNAL_PORT = "443"
  })
  secret_env = merge(local.generated_secret_env, {
    PRIVATE_SIGNING_KEY = var.signing_private_key
    PUBLIC_SIGNING_KEY  = var.signing_public_key
  })
}

resource "digitalocean_app" "conductor_app_service" {
  spec {
    name   = "api-${replace(var.deployment_domain, ".", "-")}"
    region = var.region

    domain {
      name = var.api_domain
      type = "PRIMARY"
      zone = var.deployment_domain
    }

    alert {
      rule = "DEPLOYMENT_FAILED"
    }

    alert {
      rule = "DOMAIN_FAILED"
    }

    service {
      name      = "api-service"
      http_port = tonumber(local.env.CONDUCTOR_INTERNAL_PORT)
      image {
        registry_type        = var.conductor_registry_type
        registry             = var.conductor_registry
        repository           = var.conductor_repository
        tag                  = var.conductor_docker_image_tag
        registry_credentials = var.registry_credentials
      }
      instance_size_slug = var.instance_size
      # Add environment variables for build
      dynamic "env" {
        for_each = local.env
        content {
          key   = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = local.secret_env
        content {
          key   = env.key
          value = env.value
          type  = "SECRET"
        }
      }

      health_check {
        http_path             = "/up"
        initial_delay_seconds = 60
        period_seconds        = 120
      }

    }
  }
}