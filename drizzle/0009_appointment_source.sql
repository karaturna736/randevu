ALTER TABLE appointments ADD COLUMN source TEXT NOT NULL DEFAULT 'web';
CREATE INDEX appointments_source ON appointments(tenant_id,source,created_at);
