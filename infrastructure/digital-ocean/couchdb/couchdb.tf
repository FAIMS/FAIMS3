data "cloudinit_config" "couchdb_config" {
  gzip = false
  base64_encode = false

  part {
    content_type = "text/cloud-config"
    content = yamlencode({
        users = [
            {
                name = "couchdb.${var.subdomain}"
                shell = "/bin/bash"
                sudo = "ALL=(ALL) NOPASSWD:ALL"
                ssh_authorized_keys = [var.authorized_key]
            }
        ]
        disable_root = true
        write_files = [
            {
                encoding = "b64"
                path = "/opt/couchdb/.env"
                content = var.couchdb_env_b64
            },
            {
                encoding = "b64"
                content = var.local_ini_b64
                path = "/opt/couchdb/etc/local.d/local.ini"
            },
            {
                encoding = "b64"
                content =  base64encode(file("${path.module}/couchdb.sh"))
                path =  "/opt/couchdb/couchdb.sh"
                permissions = "0755"
            }
        ]
        runcmd = [
            "curl -fsSL https://get.docker.com | sh",
            "/opt/couchdb/couchdb.sh init",
            "/opt/couchdb/couchdb.sh start"
        ]
    })
  }
}

resource "digitalocean_volume" "couchdb-volume" {
  region                  = "syd1"
  count                   = var.instance_count
  name                    = "couchdb-data"
  size                    = 100
  initial_filesystem_type = "ext4"
  description             = "couchdb storage"
}

resource "digitalocean_droplet" "couchdb" {
    image = "ubuntu-22-04-x64"
    name = "couchdb-${count.index}"
    region = "syd1"
    size = "s-1vcpu-1gb"
    count = var.instance_count
    ssh_keys = [
        data.digitalocean_ssh_key.terraform.id
    ]
    user_data = data.cloudinit_config.couchdb_config.rendered
    volume_ids = [digitalocean_volume.couchdb-volume[count.index].id]
}

resource "digitalocean_domain" "couchdb" {
  name       = "couchdb-${count.index}.${var.subdomain}"
  ip_address = digitalocean_droplet.couchdb-droplet[count.index].ipv4_address
  count = var.instance_count
}