locals {
  generated_backup_env = <<-EOT
COUCHDB_DATA_DIR=/mnt/couchdb/data
DO_SPACES_ENDPOINT=${var.backup_endpoint}
DO_SPACES_BUCKET=${var.backup_bucket}
AWS_ACCESS_KEY_ID=${var.backup_access_key_id}
AWS_SECRET_ACCESS_KEY=${var.backup_secret_access_key}
RESTIC_PASSWORD=${var.restic_password}
KEEP_DAILY=${var.backup_keep_daily}
KEEP_WEEKLY=${var.backup_keep_weekly}
KEEP_MONTHLY=${var.backup_keep_monthly}
BACKUP_TAG=${var.backup_tag}
LOG_DIR=${var.backup_log_dir}
NOTIFY_EMAIL=
NOTIFY_WEBHOOK=
EOT

  generated_backup_service = <<-EOT
[Unit]
Description=Run CouchDB backup to DigitalOcean Spaces via restic
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
ExecStart=/opt/backup/couchdb-backup-restic.sh
User=root
Group=root
EOT

  generated_backup_timer = <<-EOT
[Unit]
Description=Schedule CouchDB backups

[Timer]
TimeZone=UTC
OnCalendar=${var.backup_on_calendar}
Persistent=true
RandomizedDelaySec=${var.backup_randomized_delay_sec}
AccuracySec=1m

[Install]
WantedBy=timers.target
EOT

  generated_local_ini = <<-EOT
; CouchDB Configuration Settings for FAIMS

[couchdb]
max_document_size = 4294967296
os_process_timeout = 5000
database_dir = /mnt/couchdb/data
view_index_dir = /mnt/couchdb/data
single_node = true

[chttpd]
port = 5984
bind_address = 0.0.0.0
authentication_handlers = {chttpd_auth, cookie_authentication_handler}, {chttpd_auth, jwt_authentication_handler}, {chttpd_auth, default_authentication_handler}

[httpd]
enable_cors = true

[log]
writer = syslog
level = info

[chttpd_auth]
secret = ${var.cookie_secret}

[jwt_auth]
required_claims = exp

[admins]
${var.couchdb_user} = ${var.couchdb_password}

[cors]
origins = *
headers = accept, authorization, content-type, origin, referer
credentials = true
methods = GET, PUT, POST, HEAD, DELETE
EOT
}

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
          ssh_authorized_keys = [data.digitalocean_ssh_key.terraform.public_key]
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
      }
      packages = [
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
          content     = base64encode(local.generated_backup_env)
          path        = "/opt/backup/backup.env"
          permissions = "0600"
        },
        {
          encoding    = "b64"
          content     = base64encode(local.generated_backup_service)
          path        = "/etc/systemd/system/couchdb-backup.service"
          permissions = "0644"
        },
        {
          encoding    = "b64"
          content     = base64encode(local.generated_backup_timer)
          path        = "/etc/systemd/system/couchdb-backup.timer"
          permissions = "0644"
        }
      ]
      runcmd = [
        # Wait for the attached block volume, preserve existing/restored
        # filesystems, and mount once by its stable device path.
        "DEVICE=\"\"",
        "for i in $(seq 1 30); do for link in /dev/disk/by-id/scsi-0DO_Volume_*; do if [[ -e \"$link\" ]]; then DEVICE=\"$(readlink -f \"$link\")\"; break 2; fi; done; sleep 2; done",
        "test -n \"$DEVICE\"",
        "test -b \"$DEVICE\"",
        "mkdir -p /mnt/couchdb",
        "if ! blkid -q \"$DEVICE\"; then mkfs -t ext4 \"$DEVICE\"; fi",
        "grep -q \" $DEVICE /mnt/couchdb \" /proc/mounts || mountpoint -q /mnt/couchdb || (grep -q \"/mnt/couchdb\" /etc/fstab || echo \"$DEVICE /mnt/couchdb ext4 defaults,nofail,discard 0 2\" >> /etc/fstab)",
        "mountpoint -q /mnt/couchdb || mount /mnt/couchdb",
        "mkdir -p /mnt/couchdb/data",
        # Install and configure CouchDB
        # make sure we don't automatically start CouchDB during installation
        "printf '%s\\n' 'couchdb couchdb/mode select none' | debconf-set-selections",
        "printf '%s\\n' '#!/bin/sh' 'exit 101' > /usr/sbin/policy-rc.d",
        "chmod 0755 /usr/sbin/policy-rc.d",
        # validate our couchdb version
        "COUCHDB_PACKAGE=\"$(apt-cache madison couchdb | awk -v version='${var.couchdb_version}' '$3 ~ (\"^\" version \"([.~+-]|$)\") { print $3; exit }')\"",
        "test -n \"$COUCHDB_PACKAGE\"",
        "if ! DEBIAN_FRONTEND=noninteractive apt-get install -y \"couchdb=$COUCHDB_PACKAGE\"; then rm -f /usr/sbin/policy-rc.d; exit 1; fi",
        "apt-mark hold couchdb",
        # clean up
        "rm -f /usr/sbin/policy-rc.d",
        # give the couchdb user ownership of the data directory
        "chown -R couchdb:couchdb /mnt/couchdb/data",
        # generate local.ini
        "echo '${base64encode(local.generated_local_ini)}' | base64 -d > /opt/couchdb/etc/local.d/local.ini",
        "chmod 0600 /opt/couchdb/etc/local.d/local.ini",
        "service couchdb start",
        # configure backup timer
        "systemctl daemon-reload",
        "systemctl enable --now couchdb-backup.timer"
      ]
    })
  }
}

resource "digitalocean_volume" "couchdb-volume" {
  region                  = var.region
  name                    = "couchdb-data-${replace(var.deployment_domain, ".", "-")}"
  size                    = var.couchdb_volume_size
  initial_filesystem_type = "ext4"
  snapshot_id             = trimspace(var.couchdb_volume_snapshot_id) == "" ? null : var.couchdb_volume_snapshot_id
  description             = "couchdb storage"
}

resource "digitalocean_volume_attachment" "couchdb-volume" {
  droplet_id = digitalocean_droplet.couchdb.id
  volume_id  = digitalocean_volume.couchdb-volume.id
}

resource "digitalocean_droplet" "couchdb" {
  image  = var.droplet_image
  name   = "couchdb-${var.deployment_domain}"
  region = var.region
  size   = var.droplet_size
  ssh_keys = [
    data.digitalocean_ssh_key.terraform.id
  ]
  user_data = data.cloudinit_config.couchdb_config.rendered
}

