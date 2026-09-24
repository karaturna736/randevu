import Database from "better-sqlite3";
import { chmodSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const filename = path.resolve(
  process.env.DATABASE_PATH || path.join(process.cwd(), "data/neta.sqlite"),
);
mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });

const database = new Database(filename);
database.pragma("foreign_keys = ON");
database.pragma("journal_mode = WAL");
database.pragma("synchronous = NORMAL");
database.pragma("busy_timeout = 5000");
database.exec(`
  CREATE TABLE IF NOT EXISTS __neta_migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )
`);

const applied = new Set(
  database
    .prepare("SELECT name FROM __neta_migrations")
    .all()
    .map((row) => row.name),
);
const migrations = readdirSync(path.resolve("drizzle"))
  .filter((name) => name.endsWith(".sql"))
  .sort();

for (const migration of migrations) {
  if (applied.has(migration)) continue;
  const sql = readFileSync(path.join("drizzle", migration), "utf8");
  const apply = database.transaction(() => {
    for (const statement of sql
      .split("--> statement-breakpoint")
      .map((value) => value.trim())
      .filter(Boolean))
      database.exec(statement);
    database
      .prepare(
        "INSERT INTO __neta_migrations(name,applied_at) VALUES(?,?)",
      )
      .run(migration, new Date().toISOString());
  });
  apply();
  console.log(`Uygulandı: ${migration}`);
}

database.pragma("optimize");
database.close();
chmodSync(filename, 0o600);
console.log(`Veritabanı hazır: ${filename}`);
