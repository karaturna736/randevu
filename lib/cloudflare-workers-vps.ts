import "server-only";

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

type SqlValue = string | number | bigint | Buffer | null;

function normalize(value: unknown): SqlValue {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "bigint" ||
    Buffer.isBuffer(value)
  )
    return value;
  throw new TypeError(`SQLite parametresi desteklenmiyor: ${typeof value}`);
}

class VpsD1PreparedStatement {
  private values: SqlValue[] = [];

  constructor(
    private readonly database: Database.Database,
    private readonly sql: string,
  ) {}

  bind(...values: unknown[]) {
    const statement = new VpsD1PreparedStatement(this.database, this.sql);
    statement.values = values.map(normalize);
    return statement;
  }

  async all<T = Record<string, unknown>>() {
    const results = this.database.prepare(this.sql).all(...this.values) as T[];
    return { success: true, results, meta: { changes: 0 } };
  }

  async first<T = Record<string, unknown>>() {
    return (
      (this.database.prepare(this.sql).get(...this.values) as T | undefined) ??
      null
    );
  }

  async run() {
    const result = this.execute();
    return result;
  }

  execute() {
    const statement = this.database.prepare(this.sql);
    if (statement.reader) {
      const results = statement.all(...this.values);
      return { success: true, results, meta: { changes: 0 } };
    }
    const info = statement.run(...this.values);
    return {
      success: true,
      results: [],
      meta: {
        changes: info.changes,
        last_row_id: Number(info.lastInsertRowid),
      },
    };
  }
}

class VpsD1Database {
  constructor(private readonly database: Database.Database) {}

  prepare(sql: string) {
    return new VpsD1PreparedStatement(this.database, sql);
  }

  async batch(statements: VpsD1PreparedStatement[]) {
    const transaction = this.database.transaction(
      (items: VpsD1PreparedStatement[]) => items.map((item) => item.execute()),
    );
    return transaction(statements);
  }
}

let database: VpsD1Database | undefined;

function getDatabase() {
  if (database) return database;
  const filename = path.resolve(
    process.env.DATABASE_PATH || path.join(process.cwd(), "data/neta.sqlite"),
  );
  mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
  const sqlite = new Database(filename);
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("synchronous = NORMAL");
  sqlite.pragma("busy_timeout = 5000");
  database = new VpsD1Database(sqlite);
  return database;
}

export const env = new Proxy<Record<string, unknown>>(
  {},
  {
    get(_target, property) {
      if (property === "DB") return getDatabase();
      if (typeof property !== "string") return undefined;
      return process.env[property];
    },
  },
) as Record<string, string | undefined> & { DB: VpsD1Database };
