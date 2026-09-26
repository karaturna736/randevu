#!/usr/bin/env bash
set -euo pipefail
archive="${1:?usage: package-vps.sh ARCHIVE_PATH}"
test -f .next/standalone/server.js
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
cp -R .next/standalone/. "$stage/"
mkdir -p "$stage/.next" "$stage/scripts" "$stage/drizzle"
cp -R .next/static "$stage/.next/static"
cp -R public "$stage/public"
cp scripts/migrate-sqlite.mjs scripts/backup-sqlite.mjs scripts/load-test-100.mjs scripts/run-isolated-load-test.sh scripts/configure-whatsapp.sh "$stage/scripts/"
chmod +x "$stage/scripts/run-isolated-load-test.sh" "$stage/scripts/configure-whatsapp.sh"
cp drizzle/*.sql "$stage/drizzle/"

# The VPS runs a single standalone Node process. Keep the appointment notification
# outbox moving from inside that process so manual appointment changes do not
# depend on an external cron service. The endpoint is still protected by the
# server-only AUTOMATION_SECRET and the runner only talks to loopback.
cat >> "$stage/server.js" <<'NODE'

;(() => {
  const secret = process.env.AUTOMATION_SECRET;
  if (!secret) return;
  const port = process.env.PORT || '3000';
  const endpoint = `http://127.0.0.1:${port}/api/automation/outbox`;
  let running = false;

  async function runNetaAppointmentOutbox() {
    if (running) return;
    running = true;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(12000),
      });
      const body = await response.text();
      if (!response.ok) {
        console.error(`Neta appointment notification worker returned HTTP ${response.status}: ${body.slice(0, 300)}`);
      }
    } catch (error) {
      console.error('Neta appointment notification worker failed:', error instanceof Error ? error.message : String(error));
    } finally {
      running = false;
    }
  }

  const first = setTimeout(runNetaAppointmentOutbox, 5000);
  first.unref?.();
  const timer = setInterval(runNetaAppointmentOutbox, 15000);
  timer.unref?.();
})();
NODE

tar -C "$stage" -czf "$archive" .
echo "$archive"
