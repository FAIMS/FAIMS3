resource "digitalocean_certificate" "lb_certificate" {
  name    = "lb-certificate-${var.subdomain}"
  type    = "lets_encrypt"
  domains = ["db.${var.subdomain}"]
}

resource "digitalocean_domain" "couchdb" {
  name       = "db.${var.subdomain}"
  ip_address = digitalocean_loadbalancer.couchdb-lb.ip
  depends_on = [ digitalocean_certificate.lb_certificate ]
}
resource "digitalocean_loadbalancer" "couchdb-lb" {
  name = "couchdb-lb-${var.subdomain}"
  region = "syd1"

  forwarding_rule {
    entry_port = 443
    entry_protocol = "https"

    target_port = 5984
    target_protocol = "http"
    certificate_name = digitalocean_certificate.lb_certificate.name
  }

  healthcheck {
    port = 22
    protocol = "tcp"
  }

  depends_on = [ digitalocean_certificate.lb_certificate ]

  droplet_ids = digitalocean_droplet.couchdb.*.id
}
