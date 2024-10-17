
data "cloudinit_config" "conductor_config" {
  gzip = false
  base64_encode = false

  part {
    content_type = "text/cloud-config"
    content = yamlencode({
        packages = ["nginx"]
        users = [
            {
                name = "conductor"
                shell = "/bin/bash"
                sudo = "ALL=(ALL) NOPASSWD:ALL"
                ssh_import_id = ["gh:stevecassidy"]
            }
        ]
        disable_root = true
        write_files = [
            {
                owner = "www-data:www-data"
                path = "/etc/nginx/sites-available/default"
                defer = true
                content = <<EOT
server {
    server_name conductor.${var.subdomain};
    listen 80;
    client_max_body_size 0;
    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection keep-alive;
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOT
            },
            {
                encoding = "b64"
                content = base64encode(file("../.env"))
                path = "/opt/conductor/.env"
            },
            {
                encoding = "b64"
                content = base64encode(file("./conductor.sh"))
                path = "/opt/conductor/conductor.sh"
                permissions = "0755"
            },
            {
                encoding = "b64"
                content = base64encode(file("../../../api/keys/local-dev_private_key.pem"))
                path = "/opt/conductor/keys/local-dev_private_key.pem"
            },
            {
                encoding = "b64"
                content = base64encode(file("../../../api/keys/local-dev_private_key.pem"))
                path = "/opt/conductor/keys/local-dev_public_key.pem"
            }
        ]
        runcmd = [
            "service nginx restart",
            "snap install --classic certbot",
            "sudo certbot --nginx -m ${var.contact_email} --agree-tos -d conductor.${var.subdomain} -n",
            "curl -fsSL https://get.docker.com | sh",
            "/opt/conductor/conductor.sh init",
            "/opt/conductor/conductor.sh start"
        ]
    })
  }
}

resource "digitalocean_droplet" "conductor-droplet" {
    image = "ubuntu-22-04-x64"
    name = "conductor"
    region = "syd1"
    size = "s-1vcpu-1gb"
    ssh_keys = [
        data.digitalocean_ssh_key.terraform.id
    ]
    connection {
        host = self.ipv4_address
        user = "root"
        type = "ssh"
        private_key = file(var.pvt_key)
        timeout = "2m"
    }    
    user_data = data.cloudinit_config.conductor_config.rendered
}

resource "digitalocean_domain" "conductor" {
  name       = "conductor.${var.subdomain}"
  ip_address = digitalocean_droplet.conductor-droplet.ipv4_address
}