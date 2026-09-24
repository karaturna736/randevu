import Database from "better-sqlite3";
import { chmodSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const filename = process.env.DATABASE_PATH;
if (!filename) throw new Error("DATABASE_PATH is required");
mkdirSync(dirname(filename), { recursive: true });
const db = new Database(filename);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec("CREATE TABLE IF NOT EXISTS __neta_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
const applied = new Set(db.prepare("SELECT name FROM __neta_migrations").all().map((row) => row.name));
const apply = db.transaction((name, sql) => {
  for (const statement of sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) db.exec(statement);
  db.prepare("INSERT INTO __neta_migrations(name,applied_at) VALUES(?,?)").run(name, new Date().toISOString());
});
let count = 0;
for (const name of readdirSync(resolve("drizzle")).filter((name) => name.endsWith(".sql")).sort()) {
  if (applied.has(name)) continue;
  apply(name, readFileSync(resolve("drizzle", name), "utf8"));
  count++;
}
db.close();
chmodSync(filename, 0o600);
console.log(JSON.stringify({ applied: count, database: filename }));
