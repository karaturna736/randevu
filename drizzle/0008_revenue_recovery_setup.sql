PRAGMA foreign_keys=ON;

CREATE TABLE waitlist_entries (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES businesses(id),
  service_id TEXT NOT NULL,
  staff_id TEXT,
  requested_date TEXT NOT NULL,
  minute_from INTEGER NOT NULL,
  minute_to INTEGER NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  consent INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'waiting',
  created_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id,service_id) REFERENCES services(tenant_id,id),
  FOREIGN KEY (tenant_id,staff_id) REFERENCES staff(tenant_id,id)
);
CREATE INDEX waitlist_match ON waitlist_entries(tenant_id,service_id,requested_date,status,created_at);
CREATE INDEX waitlist_phone ON waitlist_entries(tenant_id,phone,status);

CREATE TABLE recovery_slots (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES businesses(id),
  source_appointment_id TEXT NOT NULL UNIQUE,
  service_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  date TEXT NOT NULL,
  minute INTEGER NOT NULL,
  duration INTEGER NOT NULL,
  price INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  recovered_appointment_id TEXT,
  recovered_customer_id TEXT,
  recovered_amount INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  filled_at TEXT,
  FOREIGN KEY (tenant_id,source_appointment_id) REFERENCES appointments(tenant_id,id),
  FOREIGN KEY (tenant_id,service_id) REFERENCES services(tenant_id,id),
  FOREIGN KEY (tenant_id,staff_id) REFERENCES staff(tenant_id,id)
);
CREATE INDEX recovery_slot_queue ON recovery_slots(status,date,minute,created_at);
CREATE INDEX recovery_slot_tenant ON recovery_slots(tenant_id,created_at);

CREATE TABLE recovery_offers (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES businesses(id),
  recovery_slot_id TEXT NOT NULL REFERENCES recovery_slots(id),
  waitlist_id TEXT NOT NULL REFERENCES waitlist_entries(id),
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'offered',
  provider_id TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  accepted_at TEXT,
  UNIQUE(recovery_slot_id,waitlist_id)
);
CREATE INDEX recovery_offer_active ON recovery_offers(recovery_slot_id,status,expires_at);

CREATE TABLE recovery_attributions (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES businesses(id),
  appointment_id TEXT NOT NULL UNIQUE,
  customer_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  amount INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id,appointment_id) REFERENCES appointments(tenant_id,id),
  FOREIGN KEY (tenant_id,customer_id) REFERENCES customers(tenant_id,id)
);
CREATE INDEX recovery_attribution_tenant ON recovery_attributions(tenant_id,created_at);

CREATE TABLE setup_import_batches (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES businesses(id),
  kind TEXT NOT NULL,
  row_count INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX setup_import_tenant ON setup_import_batches(tenant_id,created_at);

CREATE TABLE setup_training_requests (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES businesses(id),
  preferred_date TEXT,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
);
CREATE INDEX setup_training_tenant ON setup_training_requests(tenant_id,created_at);
