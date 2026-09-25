ALTER TABLE `temporary_payment_settings` ADD COLUMN `bank_iban` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `temporary_payment_settings` ADD COLUMN `bank_account_name` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `temporary_payment_settings` ADD COLUMN `test_zero_price` integer NOT NULL DEFAULT 1;
--> statement-breakpoint
INSERT INTO `temporary_payment_settings`(
  `id`,`active`,`provider`,`normal_url`,`pro_url`,`plus_url`,`note`,`updated_by`,`updated_at`,`bank_iban`,`bank_account_name`,`test_zero_price`
) VALUES(
  1,1,'bank_transfer','','','','Geçici banka havalesi ödeme yöntemi test aşamasındadır. Kart bilgisi alınmaz veya saklanmaz.','',datetime('now'),'','',1
)
ON CONFLICT(`id`) DO UPDATE SET
  `active`=1,
  `provider`='bank_transfer',
  `test_zero_price`=1,
  `note`=CASE WHEN trim(`temporary_payment_settings`.`note`)='' THEN excluded.`note` ELSE `temporary_payment_settings`.`note` END;
