CREATE TABLE `demand_searches` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`visit_id` text NOT NULL,
	`service_id` text NOT NULL,
	`staff_key` text NOT NULL,
	`requested_date` text NOT NULL,
	`minute_from` integer NOT NULL,
	`minute_to` integer NOT NULL,
	`matched` integer NOT NULL,
	`reason` text NOT NULL,
	`price` integer NOT NULL,
	`duration` integer NOT NULL,
	`searched_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`,`visit_id`) REFERENCES `demand_visits`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`service_id`) REFERENCES `services`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `demand_searches_intent` ON `demand_searches` (`tenant_id`,`visit_id`,`service_id`,`staff_key`,`requested_date`,`minute_from`,`minute_to`);--> statement-breakpoint
CREATE INDEX `demand_searches_time` ON `demand_searches` (`tenant_id`,`searched_at`);--> statement-breakpoint
CREATE TABLE `demand_visits` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`visitor_hash` text NOT NULL,
	`day` text NOT NULL,
	`created_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`converted_at` text,
	`appointment_id` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`appointment_id`) REFERENCES `appointments`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `demand_visits_tenant_id` ON `demand_visits` (`tenant_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `demand_visits_browser_day` ON `demand_visits` (`tenant_id`,`visitor_hash`,`day`);--> statement-breakpoint
CREATE INDEX `demand_visits_day` ON `demand_visits` (`tenant_id`,`day`);--> statement-breakpoint
CREATE TABLE `early_offers` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`appointment_id` text NOT NULL,
	`appointment_version` integer NOT NULL,
	`minute` integer NOT NULL,
	`status` text DEFAULT 'offered' NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`,`appointment_id`) REFERENCES `appointments`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `early_offers_slot` ON `early_offers` (`tenant_id`,`appointment_id`,`appointment_version`,`minute`);--> statement-breakpoint
CREATE INDEX `early_offers_appointment` ON `early_offers` (`tenant_id`,`appointment_id`,`status`);--> statement-breakpoint
ALTER TABLE `appointments` ADD `service_name_snapshot` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `appointments` ADD `service_description_snapshot` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `appointments` ADD `customer_note` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `appointments` ADD `early_from` integer;--> statement-breakpoint
CREATE TABLE `__new_members` (
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'owner' NOT NULL,
	`staff_id` text,
	`disabled` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`tenant_id`, `user_id`),
	FOREIGN KEY (`tenant_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`staff_id`) REFERENCES `staff`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_members`("tenant_id", "user_id", "email", "name", "disabled") SELECT "tenant_id", "user_id", "email", "name", "disabled" FROM `members`;--> statement-breakpoint
DROP TABLE `members`;--> statement-breakpoint
ALTER TABLE `__new_members` RENAME TO `members`;--> statement-breakpoint
CREATE INDEX `members_user` ON `members` (`user_id`);--> statement-breakpoint
ALTER TABLE `services` ADD `description` text DEFAULT '' NOT NULL;
--> statement-breakpoint
UPDATE appointments SET service_name_snapshot=COALESCE((SELECT name FROM services s WHERE s.tenant_id=appointments.tenant_id AND s.id=appointments.service_id),'') WHERE service_name_snapshot='';
--> statement-breakpoint
CREATE TRIGGER early_offer_accept_guard BEFORE UPDATE OF status ON early_offers
WHEN NEW.status='accepted' AND (OLD.status!='offered' OR OLD.expires_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now'))
BEGIN
 SELECT RAISE(ABORT,'EARLY_OFFER_EXPIRED');
END;
--> statement-breakpoint
PRAGMA optimize;
