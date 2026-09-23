DROP INDEX `onboarding_payments_slug`;--> statement-breakpoint
ALTER TABLE `onboarding_payments` ADD `transaction_id` text;--> statement-breakpoint
CREATE INDEX `onboarding_payments_slug` ON `onboarding_payments` (`slug`);