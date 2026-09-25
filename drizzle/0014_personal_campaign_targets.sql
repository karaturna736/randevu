CREATE TABLE `campaign_users` (
  `id` text PRIMARY KEY NOT NULL,
  `campaign_id` text NOT NULL,
  `user_id` text NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `campaign_users_once` ON `campaign_users` (`campaign_id`,`user_id`);
--> statement-breakpoint
CREATE INDEX `campaign_users_user` ON `campaign_users` (`user_id`,`campaign_id`);
