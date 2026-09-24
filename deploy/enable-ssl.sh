#!/usr/bin/env bash
set -euo pipefail
email="${1:?LetsEncrypt email required}"
certbot --nginx --non-interactive --agree-tos --redirect --email "$email" -d netarandevu.com -d www.netarandevu.com
nginx -t
systemctl reload nginx
