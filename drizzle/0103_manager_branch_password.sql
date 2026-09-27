CREATE TABLE IF NOT EXISTS branch_manager_passwords (
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, branch_id),
  FOREIGN KEY (tenant_id, branch_id) REFERENCES branches(tenant_id, id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS branch_manager_password_lookup ON branch_manager_passwords(tenant_id, branch_id);
