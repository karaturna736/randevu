import Database from "better-sqlite3";
import { mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

const source = process.env.DATABASE_PATH;
const directory = process.env.BACKUP_DIRECTORY || "/var/backups/neta";
if (!source) throw new Error("DATABASE_PATH is required");
mkdirSync(directory, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const target = join(directory, `neta-${stamp}.sqlite`);
const db = new Database(source, { readonly: true });
await db.backup(target);
db.close();
const cutoff = Date.now() - Number(process.env.BACKUP_RETENTION_DAYS || 14) * 86400000;
for (const name of readdirSync(directory).filter((name) => /^neta-.*\.sqlite$/.test(name))) {
  const path = join(directory, name);
  if (statSync(path).mtimeMs < cutoff) rmSync(path);
}
console.log(target);
