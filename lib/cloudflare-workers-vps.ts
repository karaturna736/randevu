import Database from "better-sqlite3";

type Params = unknown[];
let database: Database.Database | null = null;

function getDatabase() {
  if (database) return database;
  const filename = process.env.DATABASE_PATH;
  if (!filename) throw new Error("DATABASE_PATH is required");
  database = new Database(filename);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.pragma("busy_timeout = 5000");
  return database;
}

class Prepared {
  constructor(
    private readonly sql: string,
    private readonly params: Params = [],
  ) {}

  bind(...params: Params) {
    return new Prepared(this.sql, params);
  }

  async first<T = Record<string, unknown>>() {
    return (getDatabase().prepare(this.sql).get(...this.params) as T) ?? null;
  }

  async all<T = Record<string, unknown>>() {
    return { results: getDatabase().prepare(this.sql).all(...this.params) as T[] };
  }

  async run() {
    const result = getDatabase().prepare(this.sql).run(...this.params);
    return {
      success: true,
      results: [],
      meta: {
        changes: result.changes,
        last_row_id: Number(result.lastInsertRowid),
      },
    };
  }
}

class D1CompatibleDatabase {
  prepare(sql: string) {
    return new Prepared(sql);
  }

  async batch(statements: Prepared[]) {
    return getDatabase().transaction(() =>
      statements.map((statement) => {
        const internal = statement as unknown as { sql: string; params: Params };
        const prepared = getDatabase().prepare(internal.sql);
        if (prepared.reader) {
          return {
            success: true,
            results: prepared.all(...internal.params),
            meta: { changes: 0 },
          };
        }
        const result = prepared.run(...internal.params);
        return {
          success: true,
          results: [],
          meta: {
            changes: result.changes,
            last_row_id: Number(result.lastInsertRowid),
          },
        };
      }),
    )();
  }
}

const DB = new D1CompatibleDatabase();
export const env = new Proxy({ DB } as Record<string, unknown>, {
  get(target, property: string) {
    if (property === "DB") return target.DB;
    return process.env[property];
  },
});
