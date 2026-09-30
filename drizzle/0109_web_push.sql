CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS push_subscriptions_tenant ON push_subscriptions(tenant_id, user_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS push_deliveries (
  event_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  delivered_at TEXT NOT NULL,
  PRIMARY KEY(event_id, endpoint)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS push_deliveries_event ON push_deliveries(event_id);
