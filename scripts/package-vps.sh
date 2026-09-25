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
cp scripts/migrate-sqlite.mjs scripts/backup-sqlite.mjs scripts/load-test-100.mjs "$stage/scripts/"
cp drizzle/*.sql "$stage/drizzle/"
tar -C "$stage" -czf "$archive" .
echo "$archive"
