locals {
  # Read environment variables from base64 encoded file
  env = { for line in split("\n", base64decode(var.conductor_env_b64)) :
    split("=", line)[0] => join("=", slice(split("=", line), 1, length(split("=", line))))
    if length(split("=", line)) >= 2 && !startswith(line, "#") && line != ""
  }
}

resource "digitalocean_app" "conductor_app_service" {
  spec {
    name   = "api-${replace(var.subdomain, ".", "-")}"
    region = var.region

    domain {
      name = "api.${var.subdomain}"
      type = "PRIMARY"
      zone = var.subdomain
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
        registry = "faims"
        repository = "faims3-api"
        tag = var.conductor_docker_image_tag
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

      health_check {
        http_path = "/api/info"
        initial_delay_seconds = 60
        period_seconds = 120
      }

      env {
        key = "CONDUCTOR_PUBLIC_URL"
        value = "https://api.${var.subdomain}"
      }
      env {
        key = "REDIRECT_WHITELIST"
        value = "https://app.${var.subdomain},https://dashboard.${var.subdomain},${local.env.VITE_APP_ID}://"
      }

      # Dynamic authentication provider configuration
      dynamic "env" {
        for_each = merge([
          for provider_name, config in var.auth_providers : {
            for k, v in {
              "AUTH_${upper(provider_name)}_TYPE"              = config.type
              "AUTH_${upper(provider_name)}_INDEX"             = tostring(config.index)
              "AUTH_${upper(provider_name)}_DISPLAY_NAME"      = config.display_name
              "AUTH_${upper(provider_name)}_HELPER_TEXT"       = config.helper_text
              "AUTH_${upper(provider_name)}_CLIENT_ID"         = config.client_id
              "AUTH_${upper(provider_name)}_CLIENT_SECRET"     = config.client_secret
              "AUTH_${upper(provider_name)}_SCOPE"             = config.scope
              "AUTH_${upper(provider_name)}_ISSUER"            = try(config.issuer, null)
              "AUTH_${upper(provider_name)}_AUTHORIZATION_URL" = try(config.authorization_url, null)
              "AUTH_${upper(provider_name)}_TOKEN_URL"         = try(config.token_url, null)
              "AUTH_${upper(provider_name)}_USER_INFO_URL"     = try(config.user_info_url, null)
            } : k => v if v != null  # Only include non-null values
          }
        ]...)
        content {
          key   = env.key
          value = env.value
          type  = contains(["CLIENT_ID", "CLIENT_SECRET"], split("_", env.key)[length(split("_", env.key)) - 1]) ? "SECRET" : null
        }
      }

      # Secrets
      env {
        key = "COUCHDB_PASSWORD"
        value = var.couchdb_password
        type = "SECRET"
      }
      env {
        key= "FAIMS_COOKIE_SECRET"
        value = var.cookie_secret
        type = "SECRET"
      }
      env {
        key = "SMTP_PASSWORD"
        value = var.smtp_password
        type = "SECRET"
      }

      # configure keys via environment
      env {
        key = "KEY_SOURCE"
        value = "ENV"
      }
      env {
        key = "PRIVATE_SIGNING_KEY"
        value = var.conductor_pvt_key_b64
        type = "SECRET"
      }
      env {
        key = "PUBLIC_SIGNING_KEY"
        value = var.conductor_pub_key_b64
        type = "SECRET"
      }
    }
  }
}