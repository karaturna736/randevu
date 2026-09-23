CREATE TABLE `credit_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`amount` integer NOT NULL,
	`kind` text NOT NULL,
	`reference` text NOT NULL,
	`description` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `credit_ledger_reference_unique` ON `credit_ledger` (`reference`);--> statement-breakpoint
CREATE INDEX `credit_ledger_tenant` ON `credit_ledger` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `growth_settings` (
	`tenant_id` text PRIMARY KEY NOT NULL,
	`theme` text DEFAULT 'auto' NOT NULL,
	`hide_brand` integer DEFAULT 0 NOT NULL,
	`autopilot` integer DEFAULT 0 NOT NULL,
	`recall_days` integer DEFAULT 30 NOT NULL,
	`welcome` text DEFAULT 'Merhaba! Randevu almak istediğiniz hizmeti ve günü yazabilirsiniz.' NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `recall_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`last_visit` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`provider_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`,`customer_id`) REFERENCES `customers`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recall_jobs_visit` ON `recall_jobs` (`tenant_id`,`customer_id`,`last_visit`);--> statement-breakpoint
CREATE TABLE `recurring_events` (
	`reference` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`amount` integer NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`test_mode` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `recurring_subscriptions` (
	`tenant_id` text PRIMARY KEY NOT NULL,
	`reference` text,
	`customer_reference` text,
	`plan_reference` text NOT NULL,
	`plan` text NOT NULL,
	`amount` integer NOT NULL,
	`state` text DEFAULT 'creating' NOT NULL,
	`token_hash` text,
	`request_id` text NOT NULL,
	`test_mode` integer DEFAULT 1 NOT NULL,
	`paid_until` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recurring_subscriptions_reference_unique` ON `recurring_subscriptions` (`reference`);--> statement-breakpoint
CREATE UNIQUE INDEX `recurring_subscriptions_token_hash_unique` ON `recurring_subscriptions` (`token_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `recurring_subscriptions_request_id_unique` ON `recurring_subscriptions` (`request_id`);--> statement-breakpoint
CREATE TABLE `referrals` (
	`referred_tenant` text PRIMARY KEY NOT NULL,
	`referrer_tenant` text NOT NULL,
	`owner_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reward` integer DEFAULT 50000 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`referred_tenant`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`referrer_tenant`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `referrals_owner_id_unique` ON `referrals` (`owner_id`);--> statement-breakpoint
CREATE TABLE `wa_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`phone` text NOT NULL,
	`reply` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`provider_id` text,
	`appointment_id` text,
	`created_at` integer NOT NULL,
	`sent_at` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`appointment_id`) REFERENCES `appointments`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `wa_messages_tenant` ON `wa_messages` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `wa_mutations` (
	`tenant_id` text NOT NULL,
	`phone` text NOT NULL,
	`version` integer NOT NULL,
	PRIMARY KEY(`tenant_id`, `phone`, `version`)
);
--> statement-breakpoint
CREATE TABLE `wa_threads` (
	`tenant_id` text NOT NULL,
	`phone` text NOT NULL,
	`state` text DEFAULT '{}' NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`tenant_id`, `phone`),
	FOREIGN KEY (`tenant_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TRIGGER credit_valid BEFORE INSERT ON credit_ledger BEGIN
 SELECT (CASE WHEN NEW.amount=0 OR NEW.amount!=CAST(NEW.amount AS INTEGER) OR (NEW.amount<0 AND COALESCE((SELECT SUM(amount) FROM credit_ledger WHERE tenant_id=NEW.tenant_id),0)+NEW.amount<0) THEN RAISE(ABORT,'CREDIT_CONFLICT') END);
END;
--> statement-breakpoint
CREATE TRIGGER credit_immutable_update BEFORE UPDATE ON credit_ledger BEGIN SELECT RAISE(ABORT,'CREDIT_CONFLICT'); END;
--> statement-breakpoint
CREATE TRIGGER credit_immutable_delete BEFORE DELETE ON credit_ledger BEGIN SELECT RAISE(ABORT,'CREDIT_CONFLICT'); END;
