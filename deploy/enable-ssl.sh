#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Bu betik root olarak çalıştırılmalıdır." >&2
  exit 1
fi
if [[ $# -ne 1 ]] || [[ ! $1 =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]; then
  echo "Kullanım: $0 <letsencrypt-e-posta>" >&2
  exit 1
fi

if [[ ! -f /etc/letsencrypt/live/netarandevu.com/fullchain.pem ]]; then
  certbot --nginx \
    --non-interactive \
    --agree-tos \
    --redirect \
    --hsts \
    --staple-ocsp \
    --email "$1" \
    -d netarandevu.com \
    -d www.netarandevu.com
fi

nginx -t
systemctl reload nginx
curl --fail --silent --show-error --max-time 10 https://netarandevu.com/api/health
echo
