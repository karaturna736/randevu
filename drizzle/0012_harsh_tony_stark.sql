CREATE TABLE `campaign_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text,
	`business_id` text,
	`user_id` text NOT NULL,
	`code` text NOT NULL,
	`plan` text NOT NULL,
	`status` text NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `campaign_attempts_campaign` ON `campaign_attempts` (`campaign_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `campaign_businesses` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`business_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `campaign_businesses_once` ON `campaign_businesses` (`campaign_id`,`business_id`);--> statement-breakpoint
CREATE INDEX `campaign_businesses_business` ON `campaign_businesses` (`business_id`,`campaign_id`);--> statement-breakpoint
CREATE TABLE `campaign_redemptions` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`business_id` text,
	`user_id` text NOT NULL,
	`subscription_id` text,
	`payment_id` text NOT NULL,
	`original_amount` integer NOT NULL,
	`discount_amount` integer NOT NULL,
	`final_amount` integer NOT NULL,
	`status` text DEFAULT 'reserved' NOT NULL,
	`failure_reason` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`redeemed_at` text,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `campaign_redemptions_payment` ON `campaign_redemptions` (`payment_id`);--> statement-breakpoint
CREATE INDEX `campaign_redemptions_campaign` ON `campaign_redemptions` (`campaign_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `campaign_redemptions_business` ON `campaign_redemptions` (`business_id`,`campaign_id`,`status`);--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`discount_type` text NOT NULL,
	`discount_value` integer NOT NULL,
	`target_type` text NOT NULL,
	`applicable_plans` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`total_usage_limit` integer,
	`per_business_limit` integer,
	`first_payment_only` integer DEFAULT 0 NOT NULL,
	`recurring_enabled` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `campaigns_code_unique` ON `campaigns` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `campaigns_code_nocase_unique` ON `campaigns` (`code` COLLATE NOCASE);--> statement-breakpoint
CREATE INDEX `campaigns_window` ON `campaigns` (`active`,`starts_at`,`ends_at`);--> statement-breakpoint
ALTER TABLE `subscription_orders` ADD `original_amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `subscription_orders` ADD `campaign_id` text;
