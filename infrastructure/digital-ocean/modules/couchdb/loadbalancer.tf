resource "digitalocean_certificate" "lb_certificate" {
  name    = "lb-certificate-${replace(var.deployment_domain, ".", "-")}"
  type    = "lets_encrypt"
  domains = [var.couch_domain]

  depends_on = [digitalocean_domain.couchdb]
}

resource "digitalocean_domain" "couchdb" {
  name = var.couch_domain

  lifecycle {
    # Existing deployments stored the LB IP on this resource. Keep that legacy
    # state stable during migration to the separate A record.
    ignore_changes = [ip_address]
  }
}

resource "digitalocean_loadbalancer" "couchdb-lb" {
  name   = "couchdb-lb-${replace(var.deployment_domain, ".", "-")}"
  region = var.region

  forwarding_rule {
    entry_port     = 443
    entry_protocol = "https"

    target_port      = 5984
    target_protocol  = "http"
    certificate_name = digitalocean_certificate.lb_certificate.name
  }

  healthcheck {
    port                   = 5984
    path                   = "/"
    protocol               = "http"
    check_interval_seconds = 60
  }

  depends_on = [digitalocean_certificate.lb_certificate]

  droplet_ids = [digitalocean_droplet.couchdb.id]
}

resource "digitalocean_record" "couchdb" {
  domain = digitalocean_domain.couchdb.name
  type   = "A"
  name   = "@"
  value  = digitalocean_loadbalancer.couchdb-lb.ip
  ttl    = 300
}
