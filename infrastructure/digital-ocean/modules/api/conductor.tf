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
    KEY_SOURCE = "ENV"
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
      name = "api-service"
      image {
        registry_type = "GHCR"
        registry      = "faims"
        repository    = "faims3-api"
        tag           = var.conductor_docker_image_tag
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
        http_path             = "/api/info"
        initial_delay_seconds = 60
        period_seconds        = 120
      }

    }
  }
}