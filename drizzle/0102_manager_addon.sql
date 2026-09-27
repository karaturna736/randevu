ALTER TABLE members ADD COLUMN branch_id TEXT;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS tenant_addons (
  tenant_id TEXT NOT NULL REFERENCES businesses(id),
  code TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  PRIMARY KEY (tenant_id, code)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS members_branch_role ON members(tenant_id, branch_id, role);
