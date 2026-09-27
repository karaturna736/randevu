CREATE TABLE IF NOT EXISTS addon_catalog (
  code TEXT PRIMARY KEY,
  price INTEGER,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);
--> statement-breakpoint
INSERT OR IGNORE INTO addon_catalog(code,price,updated_at,updated_by)
VALUES('management',NULL,datetime('now'),'system');
