CREATE TABLE IF NOT EXISTS notification_events (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  appointment_id TEXT,
  type TEXT NOT NULL CHECK (type IN ('appointment.created','appointment.updated','appointment.cancelled','appointment.payment_updated')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS notification_events_tenant_created
  ON notification_events (tenant_id, created_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS notification_events_appointment
  ON notification_events (tenant_id, appointment_id, created_at DESC);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS notification_reads (
  notification_id TEXT NOT NULL REFERENCES notification_events(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  read_at TEXT NOT NULL,
  PRIMARY KEY (notification_id, user_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS notification_reads_user
  ON notification_reads (user_id, read_at DESC);
