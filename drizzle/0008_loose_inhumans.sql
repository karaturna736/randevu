CREATE TABLE `onboarding_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`user_email` text NOT NULL,
	`user_name` text NOT NULL,
	`slug` text NOT NULL,
	`provider` text DEFAULT 'iyzico' NOT NULL,
	`plan` text NOT NULL,
	`plan_reference` text NOT NULL,
	`amount` integer NOT NULL,
	`currency` text DEFAULT 'TRY' NOT NULL,
	`payload` text NOT NULL,
	`state` text DEFAULT 'pending_payment' NOT NULL,
	`token_hash` text,
	`reference` text,
	`customer_reference` text,
	`tenant_id` text,
	`failure_reason` text DEFAULT '' NOT NULL,
	`test_mode` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`paid_at` text,
	`failed_at` text,
	`refunded_at` text,
	`account_activated_at` text,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `onboarding_payments_token_hash_unique` ON `onboarding_payments` (`token_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `onboarding_payments_reference_unique` ON `onboarding_payments` (`reference`);--> statement-breakpoint
CREATE UNIQUE INDEX `onboarding_payments_tenant_id_unique` ON `onboarding_payments` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `onboarding_payments_user` ON `onboarding_payments` (`user_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `onboarding_payments_slug` ON `onboarding_payments` (`slug`);--> statement-breakpoint
CREATE TABLE `payment_events` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`event_key` text NOT NULL,
	`event_type` text NOT NULL,
	`payment_id` text NOT NULL,
	`processed_at` text NOT NULL,
	`result` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_events_event_key_unique` ON `payment_events` (`event_key`);--> statement-breakpoint
CREATE INDEX `payment_events_payment` ON `payment_events` (`payment_id`,`processed_at`);--> statement-breakpoint
CREATE TABLE `waitlist` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`service_id` text NOT NULL,
	`staff_id` text,
	`date` text NOT NULL,
	`minute_from` integer NOT NULL,
	`minute_to` integer NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`consent` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'waiting' NOT NULL,
	`created_at` text NOT NULL,
	`notified_at` text,
	FOREIGN KEY (`tenant_id`,`service_id`) REFERENCES `services`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`staff_id`) REFERENCES `staff`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `waitlist_request` ON `waitlist` (`tenant_id`,`service_id`,`date`,`phone`);--> statement-breakpoint
CREATE INDEX `waitlist_open` ON `waitlist` (`tenant_id`,`date`,`status`);--> statement-breakpoint
ALTER TABLE `appointments` ADD `source` text DEFAULT 'web' NOT NULL;--> statement-breakpoint
ALTER TABLE `appointments` ADD `meeting_url` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `appointments` ADD `deposit_amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `appointments` ADD `payment_status` text DEFAULT 'not_required' NOT NULL;--> statement-breakpoint
ALTER TABLE `businesses` ADD `terminology` text DEFAULT 'Hizmet' NOT NULL;--> statement-breakpoint
ALTER TABLE `businesses` ADD `online_enabled` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `businesses` ADD `deposit_percent` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `services` ADD `delivery_mode` text DEFAULT 'in_person' NOT NULL;--> statement-breakpoint
ALTER TABLE `services` ADD `meeting_url` text DEFAULT '' NOT NULL;