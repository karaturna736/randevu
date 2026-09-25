#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${NETA_ENV_FILE:-/etc/neta/neta.env}"
APP_DIR="${NETA_APP_DIR:-/opt/neta/current}"

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Bu kurulum root yetkisiyle çalıştırılmalı: sudo $0" >&2
  exit 1
fi
[[ -f "$ENV_FILE" ]] || { echo "$ENV_FILE bulunamadı." >&2; exit 1; }
[[ -d "$APP_DIR" ]] || { echo "$APP_DIR bulunamadı." >&2; exit 1; }

cd "$APP_DIR"
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

DATABASE_PATH="${DATABASE_PATH:-/var/lib/neta/neta.sqlite}"
[[ -f "$DATABASE_PATH" ]] || { echo "Veritabanı bulunamadı: $DATABASE_PATH" >&2; exit 1; }

echo
echo "Neta WhatsApp Cloud API kurulumu"
echo "Kullanılabilir gerçek işletmeler:"
DATABASE_PATH="$DATABASE_PATH" node <<'NODE'
const Database = require('better-sqlite3');
const db = new Database(process.env.DATABASE_PATH, { readonly: true });
for (const row of db.prepare("SELECT id,name,status FROM businesses WHERE demo=0 AND status NOT IN ('deleted','suspended') ORDER BY created_at DESC LIMIT 50").all()) {
  console.log(`- ${row.name} | ${row.id} | ${row.status}`);
}
db.close();
NODE

echo
read -r -p "Bağlanacak işletme ID (tenant_id): " TENANT_ID
TENANT_ID="${TENANT_ID//[[:space:]]/}"
[[ -n "$TENANT_ID" ]] || { echo "tenant_id gerekli." >&2; exit 1; }

TENANT_OK="$(DATABASE_PATH="$DATABASE_PATH" TENANT_ID="$TENANT_ID" node <<'NODE'
const Database = require('better-sqlite3');
const db = new Database(process.env.DATABASE_PATH, { readonly: true });
const row = db.prepare("SELECT id FROM businesses WHERE id=? AND demo=0 AND status NOT IN ('deleted','suspended')").get(process.env.TENANT_ID);
process.stdout.write(row ? 'yes' : 'no');
db.close();
NODE
)"
[[ "$TENANT_OK" == "yes" ]] || { echo "Bu tenant_id geçerli bir gerçek işletmeye ait değil." >&2; exit 1; }

read -r -p "Meta Phone Number ID: " PHONE_ID
PHONE_ID="${PHONE_ID//[[:space:]]/}"
[[ "$PHONE_ID" =~ ^[0-9]+$ ]] || { echo "Phone Number ID yalnızca rakamlardan oluşmalı." >&2; exit 1; }

read -r -p "WhatsApp işletme numarası (+905...): " BUSINESS_NUMBER
BUSINESS_NUMBER="${BUSINESS_NUMBER//[[:space:]]/}"
[[ "$BUSINESS_NUMBER" =~ ^\+?[0-9]{10,15}$ ]] || { echo "Telefon numarası geçersiz." >&2; exit 1; }

read -r -p "İşletme sahibinin bildirim numarası (+905..., boş bırakılabilir): " OWNER_NUMBER
OWNER_NUMBER="${OWNER_NUMBER//[[:space:]]/}"
if [[ -n "$OWNER_NUMBER" && ! "$OWNER_NUMBER" =~ ^\+?[0-9]{10,15}$ ]]; then
  echo "Sahip telefonu geçersiz." >&2
  exit 1
fi

read -r -p "Meta Graph API sürümü (ör. vXX.0; uygulama panelinde görünen sürüm): " GRAPH_VERSION
GRAPH_VERSION="${GRAPH_VERSION//[[:space:]]/}"
[[ "$GRAPH_VERSION" =~ ^v[0-9]+\.0$ ]] || { echo "Graph API sürümü vNN.0 biçiminde olmalı." >&2; exit 1; }

read -r -s -p "Meta App Secret (ekranda görünmez): " META_SECRET_INPUT
echo
[[ ${#META_SECRET_INPUT} -ge 10 ]] || { echo "Meta App Secret eksik görünüyor." >&2; exit 1; }

read -r -s -p "WhatsApp System User Access Token (ekranda görünmez): " ACCESS_TOKEN_INPUT
echo
[[ ${#ACCESS_TOKEN_INPUT} -ge 20 ]] || { echo "Access Token eksik görünüyor." >&2; exit 1; }

EXISTING_JSON="${WHATSAPP_CONNECTIONS_JSON:-[]}"
if [[ ! "${APP_ENCRYPTION_KEY:-}" =~ ^[a-fA-F0-9]{64}$ ]]; then
  if [[ "$EXISTING_JSON" != "[]" && -n "$EXISTING_JSON" ]]; then
    echo "Mevcut WhatsApp bağlantıları varken APP_ENCRYPTION_KEY geçersiz. Anahtarı otomatik değiştirmiyorum." >&2
    exit 1
  fi
  APP_ENCRYPTION_KEY="$(openssl rand -hex 32)"
fi

VERIFY_TOKEN="$(openssl rand -hex 24)"

NEW_CONNECTIONS="$(
  EXISTING_JSON="$EXISTING_JSON" \
  TENANT_ID="$TENANT_ID" \
  PHONE_ID="$PHONE_ID" \
  BUSINESS_NUMBER="$BUSINESS_NUMBER" \
  OWNER_NUMBER="$OWNER_NUMBER" \
  ACCESS_TOKEN_INPUT="$ACCESS_TOKEN_INPUT" \
  node <<'NODE'
let rows = [];
try {
  const parsed = JSON.parse(process.env.EXISTING_JSON || '[]');
  if (Array.isArray(parsed)) rows = parsed;
} catch {}
const tenant = process.env.TENANT_ID;
const phoneId = process.env.PHONE_ID;
rows = rows.filter((row) => row && row.tenant_id !== tenant && row.phone_id !== phoneId);
const next = {
  tenant_id: tenant,
  phone_id: phoneId,
  number: process.env.BUSINESS_NUMBER,
  token: process.env.ACCESS_TOKEN_INPUT,
  language: 'tr'
};
if (process.env.OWNER_NUMBER) next.owner_number = process.env.OWNER_NUMBER;
rows.push(next);
process.stdout.write(JSON.stringify(rows));
NODE
)"

backup="${ENV_FILE}.bak-whatsapp-$(date -u +%Y%m%dT%H%M%SZ)"
cp -a "$ENV_FILE" "$backup"

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
awk '!/^(META_APP_SECRET|META_VERIFY_TOKEN|WHATSAPP_GRAPH_VERSION|WHATSAPP_CONNECTIONS_JSON|APP_ENCRYPTION_KEY|PUBLIC_SITE_READY)=/' "$ENV_FILE" > "$tmp"

write_env() {
  local key="$1" value="$2" escaped
  printf -v escaped '%q' "$value"
  printf '%s=%s\n' "$key" "$escaped" >> "$tmp"
}
write_env META_APP_SECRET "$META_SECRET_INPUT"
write_env META_VERIFY_TOKEN "$VERIFY_TOKEN"
write_env WHATSAPP_GRAPH_VERSION "$GRAPH_VERSION"
write_env WHATSAPP_CONNECTIONS_JSON "$NEW_CONNECTIONS"
write_env APP_ENCRYPTION_KEY "$APP_ENCRYPTION_KEY"
write_env PUBLIC_SITE_READY "true"

install -m 600 -o root -g root "$tmp" "$ENV_FILE"
unset META_SECRET_INPUT ACCESS_TOKEN_INPUT NEW_CONNECTIONS

systemctl restart neta
for _ in {1..20}; do
  if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
curl -fsS http://127.0.0.1:3000/api/health >/dev/null

challenge="neta-whatsapp-ok"
verify_result="$(curl -fsS --get 'https://netarandevu.com/api/integrations/whatsapp' \
  --data-urlencode 'hub.mode=subscribe' \
  --data-urlencode "hub.verify_token=$VERIFY_TOKEN" \
  --data-urlencode "hub.challenge=$challenge")"
[[ "$verify_result" == "$challenge" ]] || { echo "Webhook doğrulama testi başarısız." >&2; exit 1; }

echo
echo "WhatsApp sunucu tarafı yapılandırıldı."
echo "Callback URL: https://netarandevu.com/api/integrations/whatsapp"
echo "Verify Token: $VERIFY_TOKEN"
echo "Meta panelinde WhatsApp > Configuration bölümünde bu ikisini girip Verify and Save yap."
echo "Ardından Webhooks > Manage altında messages alanına abone ol ve WABA için uygulama aboneliğini etkinleştir."
echo "Environment yedeği: $backup"
