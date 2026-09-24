#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
OUTPUT=${1:-"${ROOT}/neta-vps-release.tar.gz"}

cd "${ROOT}"
test -f .next/standalone/server.js
rm -rf .next/standalone/.next/static .next/standalone/public .next/standalone/scripts .next/standalone/drizzle
install -d .next/standalone/.next
cp -a .next/static .next/standalone/.next/static
cp -a public .next/standalone/public
install -d .next/standalone/scripts .next/standalone/drizzle
cp scripts/migrate-sqlite.mjs scripts/backup-sqlite.mjs .next/standalone/scripts/
cp drizzle/*.sql .next/standalone/drizzle/
tar -C .next/standalone -czf "${OUTPUT}" .
echo "${OUTPUT}"
