CREATE TABLE IF NOT EXISTS notification_events (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  appointment_id TEXT,
  recipient_user_id TEXT,
  waitlist_id TEXT,
  type TEXT NOT NULL CHECK (type IN (
    'appointment.created',
    'appointment.updated',
    'appointment.cancelled',
    'appointment.payment_updated',
    'waitlist.slot_available'
  )),
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
CREATE INDEX IF NOT EXISTS notification_events_recipient_created
  ON notification_events (recipient_user_id, created_at DESC);
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
--> statement-breakpoint
ALTER TABLE waitlist_entries ADD COLUMN account_user_id TEXT;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS waitlist_entries_account
  ON waitlist_entries (account_user_id, status, created_at);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS notification_appointment_created
AFTER INSERT ON appointments
WHEN NEW.status='confirmed'
BEGIN
  INSERT INTO notification_events
    (id,tenant_id,appointment_id,type,title,message,payload,created_at)
  VALUES (
    lower(hex(randomblob(16))),
    NEW.tenant_id,
    NEW.id,
    'appointment.created',
    'Yeni randevu oluşturuldu',
    COALESCE((SELECT name FROM customers WHERE tenant_id=NEW.tenant_id AND id=NEW.customer_id),'Müşteri') ||
      ' · ' || COALESCE(NULLIF(NEW.service_name_snapshot,''),(SELECT name FROM services WHERE tenant_id=NEW.tenant_id AND id=NEW.service_id),'Hizmet') ||
      ' · ' || NEW.date || ' ' || printf('%02d:%02d', CAST(NEW.minute / 60 AS INTEGER), NEW.minute % 60),
    json_object(
      'customer_name',COALESCE((SELECT name FROM customers WHERE tenant_id=NEW.tenant_id AND id=NEW.customer_id),''),
      'customer_phone',COALESCE((SELECT phone FROM customers WHERE tenant_id=NEW.tenant_id AND id=NEW.customer_id),''),
      'service_name',COALESCE(NULLIF(NEW.service_name_snapshot,''),(SELECT name FROM services WHERE tenant_id=NEW.tenant_id AND id=NEW.service_id),''),
      'staff_name',COALESCE((SELECT name FROM staff WHERE tenant_id=NEW.tenant_id AND id=NEW.staff_id),''),
      'date',NEW.date,
      'minute',NEW.minute,
      'status',NEW.status,
      'source',NEW.source,
      'price',NEW.price
    ),
    strftime('%Y-%m-%dT%H:%M:%fZ','now')
  );
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS notification_appointment_cancelled
AFTER UPDATE OF status ON appointments
WHEN OLD.status<>NEW.status AND NEW.status='cancelled'
BEGIN
  INSERT INTO notification_events
    (id,tenant_id,appointment_id,type,title,message,payload,created_at)
  VALUES (
    lower(hex(randomblob(16))),
    NEW.tenant_id,
    NEW.id,
    'appointment.cancelled',
    'Randevu iptal edildi',
    COALESCE((SELECT name FROM customers WHERE tenant_id=NEW.tenant_id AND id=NEW.customer_id),'Müşteri') ||
      ' · ' || COALESCE(NULLIF(NEW.service_name_snapshot,''),(SELECT name FROM services WHERE tenant_id=NEW.tenant_id AND id=NEW.service_id),'Hizmet') ||
      ' · ' || NEW.date || ' ' || printf('%02d:%02d', CAST(NEW.minute / 60 AS INTEGER), NEW.minute % 60),
    json_object(
      'customer_name',COALESCE((SELECT name FROM customers WHERE tenant_id=NEW.tenant_id AND id=NEW.customer_id),''),
      'customer_phone',COALESCE((SELECT phone FROM customers WHERE tenant_id=NEW.tenant_id AND id=NEW.customer_id),''),
      'service_name',COALESCE(NULLIF(NEW.service_name_snapshot,''),(SELECT name FROM services WHERE tenant_id=NEW.tenant_id AND id=NEW.service_id),''),
      'staff_name',COALESCE((SELECT name FROM staff WHERE tenant_id=NEW.tenant_id AND id=NEW.staff_id),''),
      'date',NEW.date,
      'minute',NEW.minute,
      'status',NEW.status,
      'source',NEW.source,
      'price',NEW.price
    ),
    strftime('%Y-%m-%dT%H:%M:%fZ','now')
  );
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS notification_appointment_rescheduled
AFTER UPDATE OF date,minute,staff_id ON appointments
WHEN NEW.status='confirmed' AND (
  OLD.date<>NEW.date OR OLD.minute<>NEW.minute OR OLD.staff_id<>NEW.staff_id
)
BEGIN
  INSERT INTO notification_events
    (id,tenant_id,appointment_id,type,title,message,payload,created_at)
  VALUES (
    lower(hex(randomblob(16))),
    NEW.tenant_id,
    NEW.id,
    'appointment.updated',
    'Randevu değiştirildi',
    COALESCE((SELECT name FROM customers WHERE tenant_id=NEW.tenant_id AND id=NEW.customer_id),'Müşteri') ||
      ' · yeni zaman: ' || NEW.date || ' ' || printf('%02d:%02d', CAST(NEW.minute / 60 AS INTEGER), NEW.minute % 60),
    json_object(
      'customer_name',COALESCE((SELECT name FROM customers WHERE tenant_id=NEW.tenant_id AND id=NEW.customer_id),''),
      'customer_phone',COALESCE((SELECT phone FROM customers WHERE tenant_id=NEW.tenant_id AND id=NEW.customer_id),''),
      'service_name',COALESCE(NULLIF(NEW.service_name_snapshot,''),(SELECT name FROM services WHERE tenant_id=NEW.tenant_id AND id=NEW.service_id),''),
      'staff_name',COALESCE((SELECT name FROM staff WHERE tenant_id=NEW.tenant_id AND id=NEW.staff_id),''),
      'date',NEW.date,
      'minute',NEW.minute,
      'status',NEW.status,
      'source',NEW.source,
      'price',NEW.price
    ),
    strftime('%Y-%m-%dT%H:%M:%fZ','now')
  );
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS notification_appointment_payment_updated
AFTER UPDATE OF payment_status ON appointments
WHEN COALESCE(OLD.payment_status,'')<>COALESCE(NEW.payment_status,'')
BEGIN
  INSERT INTO notification_events
    (id,tenant_id,appointment_id,type,title,message,payload,created_at)
  VALUES (
    lower(hex(randomblob(16))),
    NEW.tenant_id,
    NEW.id,
    'appointment.payment_updated',
    'Randevu ödeme durumu değişti',
    COALESCE((SELECT name FROM customers WHERE tenant_id=NEW.tenant_id AND id=NEW.customer_id),'Müşteri') ||
      ' · ' || COALESCE(NEW.payment_status,'güncellendi'),
    json_object(
      'customer_name',COALESCE((SELECT name FROM customers WHERE tenant_id=NEW.tenant_id AND id=NEW.customer_id),''),
      'service_name',COALESCE(NULLIF(NEW.service_name_snapshot,''),(SELECT name FROM services WHERE tenant_id=NEW.tenant_id AND id=NEW.service_id),''),
      'date',NEW.date,
      'minute',NEW.minute,
      'status',NEW.status,
      'payment_status',NEW.payment_status,
      'price',NEW.price
    ),
    strftime('%Y-%m-%dT%H:%M:%fZ','now')
  );
END;
