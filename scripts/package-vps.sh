#!/usr/bin/env bash
set -euo pipefail
archive="${1:?usage: package-vps.sh ARCHIVE_PATH}"
test -f .next/standalone/server.js
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
cp -R .next/standalone/. "$stage/"
mkdir -p "$stage/.next" "$stage/scripts" "$stage/drizzle" "$stage/deploy"
cp -R .next/static "$stage/.next/static"
cp -R public "$stage/public"
cp scripts/migrate-sqlite.mjs scripts/backup-sqlite.mjs scripts/load-test-100.mjs scripts/run-isolated-load-test.sh scripts/configure-whatsapp.sh "$stage/scripts/"
chmod +x "$stage/scripts/run-isolated-load-test.sh" "$stage/scripts/configure-whatsapp.sh"
cp drizzle/*.sql "$stage/drizzle/"
cp deploy/release-vps.sh deploy/neta-slot@.service "$stage/deploy/"
chmod +x "$stage/deploy/release-vps.sh"

# Each active VPS slot runs the appointment outbox and the revenue-recovery
# matcher from inside the standalone process. Provider calls stay protected by
# AUTOMATION_SECRET and are made only over loopback. Recovery itself still
# honors RECOVERY_SCHEDULER_READY, so environments can disable it explicitly.
cat >> "$stage/server.js" <<'NODE'

;(() => {
  const secret = process.env.AUTOMATION_SECRET;
  if (!secret) return;
  const port = process.env.PORT || '3000';
  const base = `http://127.0.0.1:${port}`;
  let outboxRunning = false;
  let recoveryRunning = false;

  async function postAutomation(path, label) {
    try {
      const response = await fetch(base + path, {
        method: 'POST',
        headers: { Authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(12000),
      });
      const body = await response.text();
      if (!response.ok) {
        console.error(`Neta ${label} worker returned HTTP ${response.status}: ${body.slice(0, 300)}`);
      }
    } catch (error) {
      console.error(`Neta ${label} worker failed:`, error instanceof Error ? error.message : String(error));
    }
  }

  async function runOutbox() {
    if (outboxRunning) return;
    outboxRunning = true;
    try { await postAutomation('/api/automation/outbox', 'appointment notification'); }
    finally { outboxRunning = false; }
  }

  async function runRecovery() {
    if (process.env.RECOVERY_SCHEDULER_READY !== 'true' || recoveryRunning) return;
    recoveryRunning = true;
    try { await postAutomation('/api/automation/recovery', 'waitlist recovery'); }
    finally { recoveryRunning = false; }
  }

  const firstOutbox = setTimeout(runOutbox, 5000);
  firstOutbox.unref?.();
  const outboxTimer = setInterval(runOutbox, 15000);
  outboxTimer.unref?.();

  const firstRecovery = setTimeout(runRecovery, 7000);
  firstRecovery.unref?.();
  const recoveryTimer = setInterval(runRecovery, 15000);
  recoveryTimer.unref?.();
})();
NODE

tar -C "$stage" -czf "$archive" .
echo "$archive"
