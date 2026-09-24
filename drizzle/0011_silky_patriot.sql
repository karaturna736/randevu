ALTER TABLE `businesses` ADD `invite_code` text;--> statement-breakpoint
CREATE UNIQUE INDEX `businesses_invite_code_unique` ON `businesses` (`invite_code`);
