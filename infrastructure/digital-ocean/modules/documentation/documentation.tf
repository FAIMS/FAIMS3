locals {
  # Read environment variables from file
  env_vars = { for line in split("\n", base64decode(var.env_b64)) :
    split("=", line)[0] => join("=", slice(split("=", line), 1, length(split("=", line))))
    if length(split("=", line)) >= 2 && !startswith(trimspace(line), "#") && trimspace(line) != ""
  }

  # Pass only docs-related build variables to avoid leaking unrelated values.
  docs_build_vars = {
    for k, v in local.env_vars : k => v
    if startswith(k, "VITE_") || contains(["ANDROID_APP_PUBLIC_URL", "IOS_APP_PUBLIC_URL"], k)
  }
}

resource "digitalocean_app" "fieldmark-docs" {
  spec {
    name   = "docs-${replace(var.subdomain, ".", "-")}"
    region = var.region

    domain {
      name = "docs.${var.subdomain}"
      type = "PRIMARY"
      zone = var.subdomain
    }

    alert {
      rule = "DEPLOYMENT_FAILED"
    }

    alert {
      rule = "DOMAIN_FAILED"
    }

    static_site {
      name              = "doc"
      catchall_document = "index.html"
      source_dir        = var.docs_source_dir
      output_dir        = var.docs_output_dir
      build_command     = var.docs_build_command
      environment_slug  = "python"

      github {
        branch         = "main"
        deploy_on_push = var.docs_deploy_on_push
        repo           = "FAIMS/FAIMS3"
      }

      # Add docs build-time variables consumed by Sphinx templating.
      dynamic "env" {
        for_each = local.docs_build_vars
        content {
          key   = env.key
          value = env.value
          scope = "BUILD_TIME"
        }
      }
    }
  }
}
