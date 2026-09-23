CREATE TABLE branches (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES businesses(id)
);
--> statement-breakpoint
CREATE UNIQUE INDEX branches_tenant_id ON branches(tenant_id,id);
--> statement-breakpoint
CREATE INDEX branches_tenant_active ON branches(tenant_id,active);
--> statement-breakpoint
INSERT INTO branches(id,tenant_id,name,city,address,phone,active,is_primary,created_at)
SELECT 'branch-' || id,id,'Merkez Şube',city,address,phone,1,1,created_at FROM businesses;
--> statement-breakpoint
ALTER TABLE staff ADD COLUMN branch_id TEXT;
--> statement-breakpoint
UPDATE staff SET branch_id='branch-' || tenant_id WHERE branch_id IS NULL;
--> statement-breakpoint
CREATE INDEX staff_branch ON staff(tenant_id,branch_id,active);
--> statement-breakpoint
ALTER TABLE appointments ADD COLUMN branch_id TEXT;
--> statement-breakpoint
UPDATE appointments SET branch_id=(SELECT branch_id FROM staff WHERE staff.tenant_id=appointments.tenant_id AND staff.id=appointments.staff_id) WHERE branch_id IS NULL;
--> statement-breakpoint
CREATE INDEX appointments_branch_date ON appointments(tenant_id,branch_id,date,status);
--> statement-breakpoint
CREATE TABLE branch_expenses (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  month TEXT NOT NULL,
  category TEXT NOT NULL,
  amount INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id,branch_id) REFERENCES branches(tenant_id,id)
);
--> statement-breakpoint
CREATE INDEX branch_expenses_month ON branch_expenses(tenant_id,month,branch_id);
--> statement-breakpoint
CREATE TABLE branch_month_closings (
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  month TEXT NOT NULL,
  expenses_confirmed INTEGER NOT NULL DEFAULT 0,
  confirmed_at TEXT,
  PRIMARY KEY(tenant_id,branch_id,month),
  FOREIGN KEY (tenant_id,branch_id) REFERENCES branches(tenant_id,id)
);
