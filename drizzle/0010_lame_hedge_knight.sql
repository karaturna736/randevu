CREATE TABLE `payment_consents` (
	`id` text PRIMARY KEY NOT NULL,
	`payment_id` text NOT NULL,
	`user_id` text NOT NULL,
	`consent_type` text NOT NULL,
	`document_version` text NOT NULL,
	`accepted_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_consents_once` ON `payment_consents` (`payment_id`,`consent_type`);--> statement-breakpoint
CREATE INDEX `payment_consents_user` ON `payment_consents` (`user_id`,`accepted_at`);--> statement-breakpoint
ALTER TABLE `onboarding_payments` ADD `idempotency_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `onboarding_payments_idempotency_key_unique` ON `onboarding_payments` (`idempotency_key`);