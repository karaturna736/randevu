CREATE TABLE `journeys` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`title` text NOT NULL,
	`template` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`share_hash` text NOT NULL,
	`shared` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`,`customer_id`) REFERENCES `customers`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `journeys_share_hash_unique` ON `journeys` (`share_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `journeys_tenant_id` ON `journeys` (`tenant_id`,`id`);--> statement-breakpoint
CREATE INDEX `journeys_customer` ON `journeys` (`tenant_id`,`customer_id`);--> statement-breakpoint
CREATE TABLE `journey_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`journey_id` text NOT NULL,
	`position` integer NOT NULL,
	`title` text NOT NULL,
	`due_date` text,
	`completed_at` text,
	FOREIGN KEY (`tenant_id`,`journey_id`) REFERENCES `journeys`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `journey_steps_order` ON `journey_steps` (`tenant_id`,`journey_id`,`position`);--> statement-breakpoint
CREATE TABLE `journey_mutations` (
	`tenant_id` text NOT NULL,
	`journey_id` text NOT NULL,
	`version` integer NOT NULL,
	PRIMARY KEY(`tenant_id`, `journey_id`, `version`),
	FOREIGN KEY (`tenant_id`,`journey_id`) REFERENCES `journeys`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `receivables` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`appointment_id` text,
	`title` text NOT NULL,
	`amount` integer NOT NULL,
	`remaining` integer NOT NULL,
	`due_date` text,
	`status` text DEFAULT 'open' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`idempotency_key` text NOT NULL,
	FOREIGN KEY (`tenant_id`,`customer_id`) REFERENCES `customers`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`appointment_id`) REFERENCES `appointments`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `receivables_tenant_id` ON `receivables` (`tenant_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `receivables_request` ON `receivables` (`tenant_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `receivables_customer` ON `receivables` (`tenant_id`,`customer_id`,`status`);--> statement-breakpoint
CREATE TABLE `receivable_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`receivable_id` text NOT NULL,
	`amount` integer NOT NULL,
	`method` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'recorded' NOT NULL,
	`reversal_reason` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`reversed_at` text,
	`idempotency_key` text NOT NULL,
	FOREIGN KEY (`tenant_id`,`receivable_id`) REFERENCES `receivables`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `receivable_payments_request` ON `receivable_payments` (`tenant_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `receivable_payments_debt` ON `receivable_payments` (`tenant_id`,`receivable_id`);--> statement-breakpoint
CREATE TRIGGER receivable_valid BEFORE INSERT ON receivables BEGIN
 SELECT CASE WHEN NEW.amount<=0 OR NEW.amount!=CAST(NEW.amount AS INTEGER) OR NEW.remaining!=NEW.amount OR NEW.status!='open' THEN RAISE(ABORT,'RECEIVABLE_CONFLICT') END;
END;
--> statement-breakpoint
CREATE TRIGGER receivable_update_valid BEFORE UPDATE ON receivables BEGIN
 SELECT CASE WHEN NEW.amount!=OLD.amount OR NEW.tenant_id!=OLD.tenant_id OR NEW.customer_id!=OLD.customer_id OR NEW.remaining<0 OR NEW.remaining>NEW.amount OR (NEW.status='void' AND NEW.remaining!=NEW.amount) THEN RAISE(ABORT,'RECEIVABLE_CONFLICT') END;
END;
--> statement-breakpoint
CREATE TRIGGER collection_valid BEFORE INSERT ON receivable_payments BEGIN
 SELECT CASE WHEN NEW.status!='recorded' OR NEW.amount<=0 OR NEW.amount!=CAST(NEW.amount AS INTEGER) OR NOT EXISTS(SELECT 1 FROM receivables WHERE tenant_id=NEW.tenant_id AND id=NEW.receivable_id AND status='open' AND remaining>=NEW.amount) THEN RAISE(ABORT,'RECEIVABLE_CONFLICT') END;
END;
--> statement-breakpoint
CREATE TRIGGER collection_apply AFTER INSERT ON receivable_payments BEGIN
 UPDATE receivables SET remaining=remaining-NEW.amount WHERE tenant_id=NEW.tenant_id AND id=NEW.receivable_id;
END;
--> statement-breakpoint
CREATE TRIGGER collection_reversal_valid BEFORE UPDATE ON receivable_payments BEGIN
 SELECT CASE WHEN NEW.amount!=OLD.amount OR NEW.tenant_id!=OLD.tenant_id OR NEW.receivable_id!=OLD.receivable_id OR OLD.status!='recorded' OR NEW.status!='reversed' OR LENGTH(NEW.reversal_reason)<3 THEN RAISE(ABORT,'RECEIVABLE_CONFLICT') END;
END;
--> statement-breakpoint
CREATE TRIGGER collection_reverse AFTER UPDATE ON receivable_payments WHEN OLD.status='recorded' AND NEW.status='reversed' BEGIN
 UPDATE receivables SET remaining=remaining+OLD.amount WHERE tenant_id=OLD.tenant_id AND id=OLD.receivable_id;
END;
--> statement-breakpoint
CREATE TRIGGER collection_no_delete BEFORE DELETE ON receivable_payments BEGIN SELECT RAISE(ABORT,'RECEIVABLE_CONFLICT'); END;
