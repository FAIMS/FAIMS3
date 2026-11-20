variable "do_token" {
  description = "digital ocean access token"
  type        = string
}

variable "region" {
  description = "Region to deploy to"
  type        = string
  default     = "syd1"
}

variable "deployment_domain" {
  description = "Base domain used to identify this deployment"
  type        = string
}

variable "docs_domain" {
  description = "Full public domain for the documentation site"
  type        = string
}


variable "env_b64" {
  description = "Base64 encoded version of .env for configuration"
}

variable "docs_source_dir" {
  description = "Path to documentation source in FAIMS3 repository"
  type        = string
  default     = "docs"
}

variable "docs_output_dir" {
  description = "Built documentation output directory relative to docs_source_dir"
  type        = string
  default     = "user/_build/html"
}

variable "docs_build_command" {
  description = "Build command run by DigitalOcean App Platform for docs"
  type        = string
  default     = "cd user && make html"
}

variable "docs_deploy_on_push" {
  description = "Whether docs are deployed automatically on each push"
  type        = bool
  default     = false
}
