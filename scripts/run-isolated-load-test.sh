#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_PATH:?DATABASE_PATH is required}"
users="${LOAD_TEST_USERS:-250}"
port="${LOAD_TEST_PORT:-3100}"
root="/opt/neta/current"
tmpdir="$(mktemp -d /tmp/neta-loadtest.XXXXXX)"
pid=""

cleanup() {
  if [[ -n "$pid" ]]; then
    kill "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
  fi
  rm -rf -- "$tmpdir"
}
trap cleanup EXIT INT TERM

cd "$root"

# Önce yalnızca önceki otomatik yük testlerinden kalmış erişimleri etkisizleştir.
# Finansal test kayıtlarını production üzerinde silmeye çalışmıyoruz; immutable
# tahsilat geçmişi nedeniyle bu doğru davranış değildir.
node --input-type=module <<'NODE'
import Database from "better-sqlite3";
const db = new Database(process.env.DATABASE_PATH);
db.pragma("busy_timeout = 10000");
const retired = db.prepare("UPDATE businesses SET status='deleted' WHERE id LIKE 'loadtest-%' AND demo=1 AND status!='deleted'").run();
db.prepare("UPDATE members SET disabled=1 WHERE tenant_id LIKE 'loadtest-%'").run();
db.prepare("DELETE FROM auth_sessions WHERE user_id LIKE 'loadtest:%'").run();
db.close();
console.log(`LOADTEST_RESIDUE_RETIRED ${retired.changes}`);
NODE

# Canlı DB'yi SQLite backup API ile tutarlı bir geçici kopyaya al.
backup_path="$(BACKUP_DIRECTORY="$tmpdir" BACKUP_RETENTION_DAYS=999 node scripts/backup-sqlite.mjs | tail -n 1)"
[[ -f "$backup_path" ]] || { echo "LOADTEST_REFUSED: isolated database backup failed" >&2; exit 2; }

# Test sunucusu production sürecinden tamamen ayrı port ve DB üzerinde çalışır.
DATABASE_PATH="$backup_path" PORT="$port" HOSTNAME=127.0.0.1 NODE_ENV=production \
  node server.js >"$tmpdir/server.log" 2>&1 &
pid="$!"

ready=0
for _ in {1..40}; do
  if curl -fsS "http://127.0.0.1:${port}/api/health" >/dev/null 2>&1; then
    ready=1
    break
  fi
  if ! kill -0 "$pid" 2>/dev/null; then
    break
  fi
  sleep 0.5
done
if [[ "$ready" != 1 ]]; then
  echo "LOADTEST_REFUSED: isolated server did not become ready" >&2
  tail -n 80 "$tmpdir/server.log" >&2 || true
  exit 2
fi

ALLOW_LOAD_TEST=1 \
LOAD_TEST_ISOLATED_DB=1 \
LOAD_TEST_USERS="$users" \
LOAD_TEST_TARGET_ORIGIN="http://127.0.0.1:${port}" \
DATABASE_PATH="$backup_path" \
node scripts/load-test-100.mjs
