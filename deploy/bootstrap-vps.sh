#!/usr/bin/env bash
set -euo pipefail
apt-get update
apt-get install -y nginx certbot python3-certbot-nginx ufw
id neta >/dev/null 2>&1 || useradd --system --home /opt/neta --shell /usr/sbin/nologin neta
id deploy >/dev/null 2>&1 || useradd --create-home --shell /bin/bash deploy
install -d -o neta -g neta /opt/neta/releases /var/lib/neta /var/backups/neta
install -d -o root -g neta -m 0750 /etc/neta
if [[ ! -f /etc/neta/neta.env ]]; then
  install -o root -g neta -m 0640 deploy/neta.env.example /etc/neta/neta.env
fi
install -o root -g root -m 0644 deploy/neta.service /etc/systemd/system/neta.service
install -o root -g root -m 0644 deploy/neta-backup.service /etc/systemd/system/neta-backup.service
install -o root -g root -m 0644 deploy/neta-backup.timer /etc/systemd/system/neta-backup.timer
install -o root -g root -m 0644 deploy/nginx-netarandevu.conf /etc/nginx/sites-available/netarandevu
install -o root -g root -m 0755 deploy/release-vps.sh /usr/local/sbin/neta-release
install -o root -g root -m 0755 deploy/enable-ssl.sh /usr/local/sbin/neta-enable-ssl
install -o root -g root -m 0440 deploy/neta-deploy.sudoers /etc/sudoers.d/neta-deploy
visudo -cf /etc/sudoers.d/neta-deploy
ln -sfn /etc/nginx/sites-available/netarandevu /etc/nginx/sites-enabled/netarandevu
rm -f /etc/nginx/sites-enabled/default
systemctl daemon-reload
systemctl enable --now nginx neta-backup.timer
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
nginx -t
