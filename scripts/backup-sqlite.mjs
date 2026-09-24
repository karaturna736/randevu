import Database from "better-sqlite3";
import { mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";

const source = path.resolve(
  process.env.DATABASE_PATH || path.join(process.cwd(), "data/neta.sqlite"),
);
const directory = path.resolve(
  process.env.BACKUP_DIRECTORY || path.join(path.dirname(source), "backups"),
);
mkdirSync(directory, { recursive: true, mode: 0o700 });
const stamp = new Date().toISOString().replaceAll(":", "-");
const destination = path.join(directory, `neta-${stamp}.sqlite`);
const database = new Database(source, { readonly: true, fileMustExist: true });
await database.backup(destination);
database.close();

const cutoff = Date.now() - 14 * 86400000;
for (const file of readdirSync(directory)) {
  if (!file.startsWith("neta-") || !file.endsWith(".sqlite")) continue;
  const target = path.join(directory, file);
  if (statSync(target).mtimeMs < cutoff) unlinkSync(target);
}
console.log(destination);
