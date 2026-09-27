#!/usr/bin/env bash
set -euo pipefail
archive="${1:?release archive required}"
case "$archive" in
  /tmp/neta-vps-release-*.tar.gz) ;;
  *) echo "Release archive must use /tmp/neta-vps-release-*.tar.gz" >&2; exit 2 ;;
esac
[[ -f "$archive" && ! -L "$archive" ]] || { echo "Release archive is not a regular file" >&2; exit 2; }

release="/opt/neta/releases/$(date -u +%Y%m%d%H%M%S)-$$"
previous="$(readlink -f /opt/neta/current 2>/dev/null || true)"
install -d -o neta -g neta "$release" /opt/neta/slots
tar -xzf "$archive" -C "$release"
chown -R neta:neta "$release"

set -a
source /etc/neta/neta.env
set +a

fail_env() {
  echo "Production environment validation failed: $1" >&2
  exit 3
}

[[ -n "${DATABASE_PATH:-}" && "$DATABASE_PATH" == /* ]] || fail_env "DATABASE_PATH must be an absolute path"

if [[ "${PUBLIC_APP_URL:-}" == "https://netarandevu.com" ]]; then
  [[ "${CHATGPT_AUTH_ENABLED:-false}" != "true" ]] || fail_env "CHATGPT_AUTH_ENABLED must stay disabled on netarandevu.com"
fi

if [[ "${GOOGLE_AUTH_ENABLED:-false}" == "true" ]]; then
  [[ "${PUBLIC_APP_URL:-}" == "https://netarandevu.com" ]] || fail_env "Google auth requires PUBLIC_APP_URL=https://netarandevu.com"
  [[ -n "${GOOGLE_CLIENT_ID:-}" ]] || fail_env "GOOGLE_CLIENT_ID is missing"
  [[ -n "${GOOGLE_CLIENT_SECRET:-}" ]] || fail_env "GOOGLE_CLIENT_SECRET is missing"
  [[ "$GOOGLE_CLIENT_ID" == *.apps.googleusercontent.com ]] || fail_env "GOOGLE_CLIENT_ID format is invalid"
fi

if [[ -n "${WHATSAPP_CONNECTIONS_JSON:-}" && "${WHATSAPP_CONNECTIONS_JSON}" != "[]" ]]; then
  [[ "${APP_ENCRYPTION_KEY:-}" =~ ^[a-fA-F0-9]{64}$ ]] || fail_env "APP_ENCRYPTION_KEY must be a 64-character hex key when WhatsApp is configured"
  [[ -n "${META_APP_SECRET:-}" ]] || fail_env "META_APP_SECRET is missing"
  [[ -n "${META_VERIFY_TOKEN:-}" ]] || fail_env "META_VERIFY_TOKEN is missing"
  [[ "${WHATSAPP_GRAPH_VERSION:-}" =~ ^v[0-9]+\.0$ ]] || fail_env "WHATSAPP_GRAPH_VERSION format is invalid"
fi

# Migrations run while the current release is still serving traffic. Production
# migrations must therefore remain backwards-compatible with the previous app.
sudo -u neta env DATABASE_PATH="$DATABASE_PATH" node "$release/scripts/migrate-sqlite.mjs"

active_port=""
if [[ -f /var/lib/neta/active-port ]]; then
  active_port="$(tr -d '\r\n ' < /var/lib/neta/active-port)"
fi
case "$active_port" in
  3000|3001) ;;
  *)
    if systemctl is-active --quiet neta-slot@3001.service; then
      active_port=3001
    elif systemctl is-active --quiet neta-slot@3000.service; then
      active_port=3000
    else
      # First blue-green migration: the legacy neta.service serves port 3000.
      active_port=3000
    fi
    ;;
esac

if [[ "$active_port" == "3000" ]]; then
  candidate_port=3001
else
  candidate_port=3000
fi

candidate_unit="neta-slot@${candidate_port}.service"
old_slot_unit="neta-slot@${active_port}.service"
candidate_previous="$(readlink -f "/opt/neta/slots/$candidate_port" 2>/dev/null || true)"

# The inactive slot may contain a stale process from an interrupted deploy.
systemctl stop "$candidate_unit" >/dev/null 2>&1 || true
ln -sfn "$release" "/opt/neta/slots/$candidate_port"
systemctl daemon-reload
systemctl start "$candidate_unit"

candidate_health=""
for _ in {1..30}; do
  if candidate_health="$(curl --connect-timeout 2 --max-time 5 --silent --show-error --fail "http://127.0.0.1:$candidate_port/api/health" 2>/dev/null)"; then
    break
  fi
  sleep 1
done

if [[ -z "$candidate_health" ]]; then
  systemctl stop "$candidate_unit" >/dev/null 2>&1 || true
  if [[ -n "$candidate_previous" && -d "$candidate_previous" ]]; then
    ln -sfn "$candidate_previous" "/opt/neta/slots/$candidate_port"
  else
    rm -f "/opt/neta/slots/$candidate_port"
  fi
  rm -rf -- "$release"
  echo "Candidate health check failed; active release was not touched" >&2
  exit 1
fi

printf '%s\n' "$candidate_health"
HEALTH="$candidate_health" node -e 'const x=JSON.parse(process.env.HEALTH||"{}"); if(x.status!=="ok"||x.database!=="ok"){console.error("Candidate production health failed"); process.exit(1)}'

upstream_file=/etc/nginx/neta-upstream.conf
old_upstream="$(cat "$upstream_file" 2>/dev/null || printf 'server 127.0.0.1:%s;\n' "$active_port")"
upstream_tmp="$(mktemp)"
printf 'server 127.0.0.1:%s;\n' "$candidate_port" > "$upstream_tmp"
install -o root -g root -m 0644 "$upstream_tmp" "$upstream_file"
rm -f "$upstream_tmp"

if ! nginx -t; then
  printf '%s\n' "$old_upstream" > "$upstream_file"
  systemctl stop "$candidate_unit" >/dev/null 2>&1 || true
  echo "Nginx candidate upstream validation failed; active release kept" >&2
  exit 1
fi

# Nginx reload is graceful: new requests move to the healthy candidate while
# old workers finish requests already using the previous app process.
systemctl reload nginx

if [[ -f /etc/letsencrypt/live/netarandevu.com/fullchain.pem ]]; then
  public_health=""
  for _ in {1..10}; do
    if public_health="$(curl --connect-timeout 2 --max-time 5 --silent --show-error --fail --resolve netarandevu.com:443:127.0.0.1 https://netarandevu.com/api/health 2>/dev/null)"; then
      break
    fi
    sleep 1
  done
  if [[ -z "$public_health" ]]; then
    printf '%s\n' "$old_upstream" > "$upstream_file"
    nginx -t
    systemctl reload nginx
    systemctl stop "$candidate_unit" >/dev/null 2>&1 || true
    echo "Public health failed after switch; previous upstream restored" >&2
    exit 1
  fi
fi

ln -sfn "$release" /opt/neta/current
printf '%s\n' "$candidate_port" > /var/lib/neta/active-port
chown neta:neta /var/lib/neta/active-port
systemctl enable "$candidate_unit" >/dev/null

# Stop the old process only after traffic has switched. --no-block prevents a
# slow SSE/worker shutdown from creating a deploy-time outage.
if [[ "$old_slot_unit" != "$candidate_unit" ]] && systemctl is-active --quiet "$old_slot_unit"; then
  systemctl disable "$old_slot_unit" >/dev/null 2>&1 || true
  systemctl stop --no-block "$old_slot_unit" >/dev/null 2>&1 || true
fi
if systemctl is-active --quiet neta.service; then
  systemctl disable neta.service >/dev/null 2>&1 || true
  systemctl stop --no-block neta.service >/dev/null 2>&1 || true
fi

# Never remove a release still referenced by either slot/current. Old releases
# are cleaned only after they are at least seven days old.
current_target="$(readlink -f /opt/neta/current 2>/dev/null || true)"
slot_3000="$(readlink -f /opt/neta/slots/3000 2>/dev/null || true)"
slot_3001="$(readlink -f /opt/neta/slots/3001 2>/dev/null || true)"
while IFS= read -r stale_release; do
  [[ "$stale_release" == "$current_target" || "$stale_release" == "$slot_3000" || "$stale_release" == "$slot_3001" ]] && continue
  rm -rf -- "$stale_release"
done < <(find /opt/neta/releases -mindepth 1 -maxdepth 1 -type d -mtime +7 -print)

rm -f -- "$archive"
echo "Zero-downtime switch complete: $active_port -> $candidate_port"
