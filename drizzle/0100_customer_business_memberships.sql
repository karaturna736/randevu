CREATE TABLE `customer_memberships` (
  `tenant_id` text NOT NULL,
  `user_id` text NOT NULL,
  `customer_id` text NOT NULL,
  `joined_at` text NOT NULL,
  `updated_at` text NOT NULL,
  PRIMARY KEY(`tenant_id`,`user_id`),
  FOREIGN KEY (`tenant_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`user_id`) REFERENCES `profiles`(`user_id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`tenant_id`,`customer_id`) REFERENCES `customers`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `customer_memberships_user` ON `customer_memberships` (`user_id`,`joined_at`);
--> statement-breakpoint
CREATE INDEX `customer_memberships_business` ON `customer_memberships` (`tenant_id`,`joined_at`);
--> statement-breakpoint
INSERT OR IGNORE INTO `customer_memberships` (`tenant_id`,`user_id`,`customer_id`,`joined_at`,`updated_at`)
SELECT g.tenant_id,
       g.user_id,
       (
         SELECT a2.customer_id
         FROM account_bookings ab2
         JOIN appointments a2 ON a2.tenant_id=ab2.tenant_id AND a2.id=ab2.appointment_id
         WHERE ab2.tenant_id=g.tenant_id AND ab2.user_id=g.user_id
         ORDER BY ab2.created_at DESC,ab2.appointment_id DESC
         LIMIT 1
       ),
       g.joined_at,
       g.updated_at
FROM (
  SELECT tenant_id,user_id,MIN(created_at) joined_at,MAX(created_at) updated_at
  FROM account_bookings
  GROUP BY tenant_id,user_id
) g
WHERE EXISTS (
  SELECT 1
  FROM account_bookings ab3
  JOIN appointments a3 ON a3.tenant_id=ab3.tenant_id AND a3.id=ab3.appointment_id
  WHERE ab3.tenant_id=g.tenant_id AND ab3.user_id=g.user_id
);
--> statement-breakpoint
CREATE TRIGGER `account_booking_customer_membership`
AFTER INSERT ON `account_bookings`
BEGIN
  INSERT INTO `customer_memberships` (`tenant_id`,`user_id`,`customer_id`,`joined_at`,`updated_at`)
  SELECT NEW.tenant_id,NEW.user_id,a.customer_id,NEW.created_at,NEW.created_at
  FROM appointments a
  WHERE a.tenant_id=NEW.tenant_id AND a.id=NEW.appointment_id
  ON CONFLICT(`tenant_id`,`user_id`) DO UPDATE SET
    `customer_id`=excluded.`customer_id`,
    `updated_at`=excluded.`updated_at`;
END;
