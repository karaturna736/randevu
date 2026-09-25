ALTER TABLE `subscriptions` ADD COLUMN `plan` text NOT NULL DEFAULT 'normal';
--> statement-breakpoint
CREATE TABLE `temporary_payment_settings` (
  `id` integer PRIMARY KEY NOT NULL,
  `active` integer NOT NULL DEFAULT 0,
  `provider` text NOT NULL DEFAULT 'iyzico_link',
  `normal_url` text NOT NULL DEFAULT '',
  `pro_url` text NOT NULL DEFAULT '',
  `plus_url` text NOT NULL DEFAULT '',
  `note` text NOT NULL DEFAULT '',
  `updated_by` text NOT NULL DEFAULT '',
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `temporary_payment_requests` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `user_email` text NOT NULL,
  `user_name` text NOT NULL,
  `plan` text NOT NULL,
  `amount` integer NOT NULL,
  `business_payload` text NOT NULL,
  `business_name` text NOT NULL,
  `business_slug` text NOT NULL,
  `payment_url` text NOT NULL,
  `status` text NOT NULL DEFAULT 'awaiting_payment',
  `receipt_note` text NOT NULL DEFAULT '',
  `tenant_id` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `reviewed_by` text,
  `reviewed_at` text
);
--> statement-breakpoint
CREATE INDEX `temporary_payment_requests_user` ON `temporary_payment_requests` (`user_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `temporary_payment_requests_status` ON `temporary_payment_requests` (`status`,`created_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `temporary_payment_requests_open_slug` ON `temporary_payment_requests` (`business_slug`) WHERE `status` IN ('awaiting_payment','awaiting_review','approving');
