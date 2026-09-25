#!/usr/bin/env bash
set -euo pipefail
archive="${1:?release archive required}"
case "$archive" in
  /tmp/neta-vps-release-*.tar.gz) ;;
  *) echo "Release archive must use /tmp/neta-vps-release-*.tar.gz" >&2; exit 2 ;;
esac
[[ -f "$archive" && ! -L "$archive" ]] || { echo "Release archive is not a regular file" >&2; exit 2; }
release="/opt/neta/releases/$(date -u +%Y%m%d%H%M%S)"
previous="$(readlink -f /opt/neta/current 2>/dev/null || true)"
install -d -o neta -g neta "$release"
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

sudo -u neta env DATABASE_PATH="$DATABASE_PATH" node "$release/scripts/migrate-sqlite.mjs"
ln -sfn "$release" /opt/neta/current
systemctl daemon-reload
systemctl restart neta
for _ in {1..30}; do
  if curl -fsS http://127.0.0.1:3000/api/health >/dev/null; then
    while IFS= read -r stale_release; do
      [[ "$stale_release" == /opt/neta/releases/* && "$stale_release" != "/opt/neta/releases/" ]] || continue
      rm -rf -- "$stale_release"
    done < <(find /opt/neta/releases -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -nr | tail -n +6 | cut -d' ' -f2-)
    rm -f -- "$archive"
    exit 0
  fi
  sleep 2
done
if [[ -n "$previous" && -d "$previous" ]]; then
  ln -sfn "$previous" /opt/neta/current
  systemctl restart neta
fi
echo "Health check failed; previous release restored" >&2
exit 1
