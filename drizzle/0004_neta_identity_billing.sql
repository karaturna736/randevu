CREATE TABLE `auth_flows` (
	`state_hash` text PRIMARY KEY NOT NULL,
	`binding_hash` text NOT NULL,
	`nonce` text NOT NULL,
	`verifier` text NOT NULL,
	`return_to` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `auth_flows_expiry` ON `auth_flows` (`expires_at`);--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`full_name` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `auth_sessions_user` ON `auth_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `auth_sessions_expiry` ON `auth_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `billing_grants` (
	`order_id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`period_days` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `subscription_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `billing_profiles` (
	`tenant_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`address` text NOT NULL,
	`phone` text NOT NULL,
	`email` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `billing_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 0 NOT NULL,
	`seller_name` text DEFAULT '' NOT NULL,
	`support_email` text DEFAULT '' NOT NULL,
	`seller_address` text DEFAULT '' NOT NULL,
	`terms_url` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `subscription_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`amount` integer NOT NULL,
	`currency` text DEFAULT 'TRY' NOT NULL,
	`period_days` integer DEFAULT 30 NOT NULL,
	`status` text DEFAULT 'creating' NOT NULL,
	`test_mode` integer DEFAULT 1 NOT NULL,
	`idempotency_key` text NOT NULL,
	`buyer_name` text NOT NULL,
	`buyer_email` text NOT NULL,
	`buyer_address` text NOT NULL,
	`terms_url` text NOT NULL,
	`terms_accepted_at` text NOT NULL,
	`created_at` text NOT NULL,
	`paid_at` text,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscription_orders_idempotency` ON `subscription_orders` (`tenant_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `subscription_orders_tenant` ON `subscription_orders` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `subscription_orders_status` ON `subscription_orders` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`tenant_id` text PRIMARY KEY NOT NULL,
	`paid_until` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE TRIGGER billing_grant_guard BEFORE INSERT ON billing_grants
WHEN NOT EXISTS (SELECT 1 FROM subscription_orders o WHERE o.id=NEW.order_id AND o.tenant_id=NEW.tenant_id AND o.period_days=NEW.period_days AND o.period_days>0 AND o.status='paid' AND o.test_mode=0)
BEGIN SELECT RAISE(ABORT, 'BILLING_INVALID_GRANT'); END;
--> statement-breakpoint
CREATE TRIGGER billing_grant_extend AFTER INSERT ON billing_grants
BEGIN
 INSERT INTO subscriptions(tenant_id,paid_until,updated_at)
 VALUES(NEW.tenant_id,strftime('%Y-%m-%dT%H:%M:%fZ',NEW.created_at,'+'||NEW.period_days||' days'),NEW.created_at)
 ON CONFLICT(tenant_id) DO UPDATE SET
 paid_until=strftime('%Y-%m-%dT%H:%M:%fZ',CASE WHEN subscriptions.paid_until>NEW.created_at THEN subscriptions.paid_until ELSE NEW.created_at END,'+'||NEW.period_days||' days'),updated_at=NEW.created_at;
END;
