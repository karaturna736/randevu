CREATE TABLE `admins` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `appointments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`service_id` text NOT NULL,
	`staff_id` text NOT NULL,
	`date` text NOT NULL,
	`minute` integer NOT NULL,
	`duration` integer NOT NULL,
	`price` integer NOT NULL,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`token_hash` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`customer_id`) REFERENCES `customers`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`service_id`) REFERENCES `services`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`staff_id`) REFERENCES `staff`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `appointments_token_hash_unique` ON `appointments` (`token_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `appointments_tenant_id` ON `appointments` (`tenant_id`,`id`);--> statement-breakpoint
CREATE INDEX `appointments_date` ON `appointments` (`tenant_id`,`date`);--> statement-breakpoint
CREATE INDEX `appointments_customer` ON `appointments` (`tenant_id`,`customer_id`);--> statement-breakpoint
CREATE TABLE `audit` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`action` text NOT NULL,
	`target_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `businesses` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`category` text NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`demo` integer DEFAULT 0 NOT NULL,
	`hours` text NOT NULL,
	`cancellation_hours` integer DEFAULT 2 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `businesses_slug_unique` ON `businesses` (`slug`);--> statement-breakpoint
CREATE TABLE `closures` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`staff_id` text,
	`date` text NOT NULL,
	`reason` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`staff_id`) REFERENCES `staff`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `closures_date` ON `closures` (`tenant_id`,`date`);--> statement-breakpoint
CREATE TABLE `complaints` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`appointment_id` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`,`appointment_id`) REFERENCES `appointments`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `complaints_tenant` ON `complaints` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`consent` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customers_tenant_id` ON `customers` (`tenant_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `customers_phone` ON `customers` (`tenant_id`,`phone`);--> statement-breakpoint
CREATE TABLE `members` (
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`disabled` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`tenant_id`, `user_id`),
	FOREIGN KEY (`tenant_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `members_user` ON `members` (`user_id`);--> statement-breakpoint
CREATE TABLE `mutations` (
	`tenant_id` text NOT NULL,
	`appointment_id` text NOT NULL,
	`version` integer NOT NULL,
	PRIMARY KEY(`tenant_id`, `appointment_id`, `version`),
	FOREIGN KEY (`tenant_id`,`appointment_id`) REFERENCES `appointments`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`appointment_id` text NOT NULL,
	`event` text NOT NULL,
	`state` text DEFAULT 'not_configured' NOT NULL,
	`scheduled_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`,`appointment_id`) REFERENCES `appointments`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `outbox_pending` ON `outbox` (`state`,`scheduled_at`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`kind` text NOT NULL,
	`amount` integer NOT NULL,
	`status` text NOT NULL,
	`provider_ref` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`appointment_id` text NOT NULL,
	`rating` integer NOT NULL,
	`comment` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`,`appointment_id`) REFERENCES `appointments`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_appointment_id_unique` ON `reviews` (`appointment_id`);--> statement-breakpoint
CREATE INDEX `reviews_tenant` ON `reviews` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `services` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`duration` integer NOT NULL,
	`price` integer NOT NULL,
	`color` text DEFAULT '#789c74' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `services_tenant_id` ON `services` (`tenant_id`,`id`);--> statement-breakpoint
CREATE TABLE `slots` (
	`tenant_id` text NOT NULL,
	`staff_id` text NOT NULL,
	`date` text NOT NULL,
	`minute` integer NOT NULL,
	`appointment_id` text NOT NULL,
	PRIMARY KEY(`tenant_id`, `staff_id`, `date`, `minute`),
	FOREIGN KEY (`tenant_id`,`appointment_id`) REFERENCES `appointments`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`staff_id`) REFERENCES `staff`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `slots_appointment` ON `slots` (`tenant_id`,`appointment_id`);--> statement-breakpoint
CREATE TABLE `staff` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`title` text DEFAULT 'Uzman' NOT NULL,
	`hours` text NOT NULL,
	`color` text DEFAULT '#e1eccd' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `staff_tenant_id` ON `staff` (`tenant_id`,`id`);