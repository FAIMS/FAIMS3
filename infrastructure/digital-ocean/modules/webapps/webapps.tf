locals {
  # Read environment variables from file
  env_vars = { for line in split("\n", base64decode(var.env_b64)) :
    split("=", line)[0] => join("=", slice(split("=", line), 1, length(split("=", line))))
    if length(split("=", line)) >= 2 && !startswith(line, "#") && line != ""
  }

  # Filter VITE_ variables for build-time environment
  vite_vars = { for k, v in local.env_vars : k => v if startswith(k, "VITE_") }
}

output "vite_variables_debug" {
  description = "VITE environment variables for debugging"
  value       = { for k, v in local.env_vars : k => v if startswith(k, "VITE_") }
  sensitive   = false
}

resource "digitalocean_app" "fieldmark-app" {
  spec {
    name   = "app-${replace(var.deployment_domain, ".", "-")}"
    region = var.region

    domain {
      name = var.app_domain
      type = "PRIMARY"
      zone = var.deployment_domain
    }

    alert {
      rule = "DEPLOYMENT_FAILED"
    }

    alert {
      rule = "DOMAIN_FAILED"
    }

    static_site {
      name              = "app"
      catchall_document = "index.html"
      environment_slug  = "node-js"

      github {
        branch         = "main"
        deploy_on_push = false
        repo           = "FAIMS/FAIMS3"
      }

      source_dir = "/"
      output_dir = "app/build"

      # Add VITE environment variables for build
      dynamic "env" {
        for_each = local.vite_vars
        content {
          key   = env.key
          value = env.value
          scope = "BUILD_TIME"
        }
      }

    }
  }
}

# Dashboard (web management interface)
resource "digitalocean_app" "fieldmark-dashboard" {
  spec {
    name   = "dashboard-${replace(var.deployment_domain, ".", "-")}"
    region = var.region

    domain {
      name = var.web_domain
      type = "PRIMARY"
      zone = var.deployment_domain
    }

    alert {
      rule = "DEPLOYMENT_FAILED"
    }

    alert {
      rule = "DOMAIN_FAILED"
    }

    static_site {
      name              = "dashboard"
      catchall_document = "index.html"
      environment_slug  = "node-js"

      github {
        branch         = "main"
        deploy_on_push = false
        repo           = "FAIMS/FAIMS3"
      }

      source_dir = "/"
      output_dir = "web/dist"

      # Add VITE environment variables for build
      dynamic "env" {
        for_each = local.vite_vars
        content {
          key   = env.key
          value = env.value
          scope = "BUILD_TIME"
        }
      }
    }
  }
}