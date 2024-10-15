resource "digitalocean_loadbalancer" "couchdb-lb" {
  name = "couchdb-lb"
  region = "syd1"

  forwarding_rule {
    entry_port = 80
    entry_protocol = "http"

    target_port = 5984
    target_protocol = "http"
  }

  healthcheck {
    port = 22
    protocol = "tcp"
  }

  droplet_ids = digitalocean_droplet.couchdb.*.id
}

resource "digitalocean_domain" "couchdb" {
  name       = "db.${var.subdomain}"
  ip_address = digitalocean_loadbalancer.couchdb-lb.ipv4_address
}