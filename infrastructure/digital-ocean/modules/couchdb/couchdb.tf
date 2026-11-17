data "cloudinit_config" "couchdb_config" {
  gzip          = false
  base64_encode = false

  part {
    content_type = "text/cloud-config"
    content = yamlencode({
      users = [
        {
          name                = "couchdb"
          shell               = "/bin/bash"
          sudo                = "ALL=(ALL) NOPASSWD:ALL"
          ssh_authorized_keys = [var.authorized_key]
        }
      ]
      disable_root = true
      apt = {
        sources = {
          couchdb = {
            keyid : "390EF70BB1EA12B2773962950EE62FB37A00258D"
            keyserver : "https://couchdb.apache.org/repo/keys.asc"
            source : "deb https://apache.jfrog.io/artifactory/couchdb-deb/ $RELEASE main"
          }
        }
        debconf_selections = {
          # install couchdb without prompting for configuration
          # since we'll add the configuration local.ini later
          c1 : "couchdb couchdb/mode select none"
        }
      }
      packages = [
        "couchdb",
        "jq",     # for backup scripts
        "restic", # for backup scripts
      ]
      write_files = [
        {
          encoding    = "b64"
          content     = filebase64("${path.module}/couchdb-backup-restic.sh")
          path        = "/opt/backup/couchdb-backup-restic.sh"
          permissions = "0755"
        },
        {
          encoding    = "b64"
          content     = filebase64("${path.module}/restore-backup.sh")
          path        = "/opt/backup/restore-backup.sh"
          permissions = "0755"
        },
        {
          encoding    = "b64"
          content     = var.backup_env_b64
          path        = "/opt/backup/backup.env"
          permissions = "0600"
        }
      ]
      runcmd = [
        # mount the volume over the couchdb data directory
        "echo /dev/disk/by-id/* '/mnt/couchdb/ ext4 defaults,nofail,discard 0 0' >> /etc/fstab",
        "mkdir -p /mnt/couchdb/",
        "mount /mnt/couchdb/",
        "mkdir /mnt/couchdb/data",
        "chown -R couchdb.couchdb /mnt/couchdb/data",
        "echo '${var.local_ini_b64}' | base64 -d > /opt/couchdb/etc/local.d/local.ini",
        "chmod 0600 /opt/couchdb/etc/local.d/local.ini",
        "service couchdb start"
      ]
    })
  }
}

resource "random_string" "cookie" {
  length  = 32
  special = false
}

resource "digitalocean_volume" "couchdb-volume" {
  region                  = var.region
  count                   = var.instance_count
  name                    = "couchdb-data-${count.index}-${replace(var.subdomain, ".", "-")}"
  size                    = var.couchdb_volume_size
  initial_filesystem_type = "ext4"
  description             = "couchdb storage"
}

resource "digitalocean_volume_attachment" "couchdb-volume" {
  count      = var.instance_count
  droplet_id = digitalocean_droplet.couchdb[count.index].id
  volume_id  = digitalocean_volume.couchdb-volume[count.index].id
}

resource "digitalocean_droplet" "couchdb" {
  image  = "ubuntu-24-04-x64"
  name   = "couchdb-${count.index}-${var.subdomain}"
  region = var.region
  size   = var.droplet_size
  count  = var.instance_count
  ssh_keys = [
    data.digitalocean_ssh_key.terraform.id
  ]
  user_data = data.cloudinit_config.couchdb_config.rendered
}

resource "digitalocean_domain" "couchdb-instance" {
  name       = "couchdb-${count.index}.${var.subdomain}"
  ip_address = digitalocean_droplet.couchdb[count.index].ipv4_address
  count      = var.instance_count
}
