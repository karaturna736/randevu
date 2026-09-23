CREATE TABLE expense_catalog_items (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES businesses(id),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'adet',
  default_unit_amount INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX expense_catalog_name ON expense_catalog_items(tenant_id,name);
--> statement-breakpoint
CREATE INDEX expense_catalog_tenant ON expense_catalog_items(tenant_id,active,name);
--> statement-breakpoint
ALTER TABLE branch_expenses ADD COLUMN catalog_item_id TEXT;
--> statement-breakpoint
ALTER TABLE branch_expenses ADD COLUMN quantity REAL NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE branch_expenses ADD COLUMN unit TEXT NOT NULL DEFAULT 'adet';
--> statement-breakpoint
CREATE INDEX branch_expenses_catalog ON branch_expenses(tenant_id,catalog_item_id);
