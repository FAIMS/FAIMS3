resource "digitalocean_firewall" "couchdb" {
  name        = "couchdb-fw-${replace(var.deployment_domain, ".", "-")}"
  droplet_ids = [digitalocean_droplet.couchdb.id]

  inbound_rule {
    protocol                  = "tcp"
    port_range                = "5984"
    source_load_balancer_uids = [digitalocean_loadbalancer.couchdb-lb.id]
  }

  dynamic "inbound_rule" {
    for_each = toset(var.admin_ssh_cidrs)
    content {
      protocol         = "tcp"
      port_range       = "22"
      source_addresses = [inbound_rule.value]
    }
  }

  outbound_rule {
    protocol              = "tcp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "udp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "icmp"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}
