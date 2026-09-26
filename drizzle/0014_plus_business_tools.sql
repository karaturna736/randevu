CREATE TABLE `website_settings` (
  `tenant_id` text PRIMARY KEY NOT NULL,
  `headline` text DEFAULT '' NOT NULL,
  `intro` text DEFAULT '' NOT NULL,
  `contact_phone` text DEFAULT '' NOT NULL,
  `instagram_url` text DEFAULT '' NOT NULL,
  `cover_url` text DEFAULT '' NOT NULL,
  `published` integer DEFAULT 0 NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `api_keys` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `name` text NOT NULL,
  `token_hash` text NOT NULL,
  `prefix` text NOT NULL,
  `last_used_at` text,
  `revoked_at` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_token_hash_unique` ON `api_keys` (`token_hash`);
--> statement-breakpoint
CREATE INDEX `api_keys_tenant` ON `api_keys` (`tenant_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `branch_automations` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `name` text NOT NULL,
  `kind` text NOT NULL,
  `source_branch_id` text NOT NULL,
  `target_branch_id` text NOT NULL,
  `enabled` integer DEFAULT 1 NOT NULL,
  `config_json` text DEFAULT '{}' NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`tenant_id`,`source_branch_id`) REFERENCES `branches`(`tenant_id`,`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`tenant_id`,`target_branch_id`) REFERENCES `branches`(`tenant_id`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `branch_automations_unique_overflow` ON `branch_automations` (`tenant_id`,`kind`,`source_branch_id`,`target_branch_id`);
--> statement-breakpoint
CREATE INDEX `branch_automations_lookup` ON `branch_automations` (`tenant_id`,`kind`,`source_branch_id`,`enabled`);
