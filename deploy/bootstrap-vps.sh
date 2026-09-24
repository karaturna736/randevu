#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Bu betik root olarak çalıştırılmalıdır." >&2
  exit 1
fi

DEPLOY_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y --no-install-recommends nginx certbot python3-certbot-nginx ufw curl ca-certificates

if ! id neta >/dev/null 2>&1; then
  useradd --system --home-dir /var/lib/neta --shell /usr/sbin/nologin neta
fi

install -d -o root -g neta -m 0750 /srv/neta /srv/neta/releases
install -d -o neta -g neta -m 0700 /var/lib/neta /var/backups/neta
install -d -o root -g root -m 0755 /etc/neta

if [[ ! -f /etc/neta/neta.env ]]; then
  install -o root -g neta -m 0640 "${DEPLOY_DIR}/neta.env.example" /etc/neta/neta.env
  automation_secret=$(openssl rand -hex 32)
  encryption_key=$(openssl rand -hex 32)
  sed -i \
    -e "s/^AUTOMATION_SECRET=.*/AUTOMATION_SECRET=${automation_secret}/" \
    -e "s/^APP_ENCRYPTION_KEY=.*/APP_ENCRYPTION_KEY=${encryption_key}/" \
    /etc/neta/neta.env
fi

install -o root -g root -m 0644 "${DEPLOY_DIR}/neta.service" /etc/systemd/system/neta.service
install -o root -g root -m 0644 "${DEPLOY_DIR}/neta-backup.service" /etc/systemd/system/neta-backup.service
install -o root -g root -m 0644 "${DEPLOY_DIR}/neta-backup.timer" /etc/systemd/system/neta-backup.timer
install -o root -g root -m 0644 "${DEPLOY_DIR}/nginx-netarandevu.conf" /etc/nginx/sites-available/netarandevu.com
ln -sfn /etc/nginx/sites-available/netarandevu.com /etc/nginx/sites-enabled/netarandevu.com
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl daemon-reload
systemctl enable --now nginx
systemctl enable --now neta-backup.timer

ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo "VDS temeli hazır. Uygulama sürümünü release-vps.sh ile yükleyin."
