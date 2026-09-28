INSERT OR IGNORE INTO addon_catalog(code,price,updated_at,updated_by)
VALUES('phone_operator',NULL,datetime('now'),'system');

CREATE TABLE IF NOT EXISTS phone_operator_settings (
  tenant_id TEXT PRIMARY KEY REFERENCES businesses(id),
  inbound_number TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL DEFAULT 'demo',
  greeting TEXT NOT NULL DEFAULT 'Merhaba. Bilgi almak için 1’e, randevu almak için 2’ye basın.',
  info_transfer_number TEXT NOT NULL DEFAULT '',
  timeout_seconds INTEGER NOT NULL DEFAULT 15,
  appointment_message TEXT NOT NULL DEFAULT 'Randevu bağlantınız WhatsApp üzerinden gönderilecektir.',
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS phone_operator_calls (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES businesses(id),
  caller_phone TEXT NOT NULL DEFAULT '',
  digit TEXT NOT NULL,
  outcome TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  provider_call_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS phone_operator_calls_lookup ON phone_operator_calls(tenant_id,created_at);
