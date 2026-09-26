CREATE TABLE `help_question_insights` (
  `id` text PRIMARY KEY NOT NULL,
  `fingerprint` text NOT NULL UNIQUE,
  `question_key` text NOT NULL,
  `sample_question` text NOT NULL,
  `ask_count` integer DEFAULT 1 NOT NULL,
  `status` text DEFAULT 'open' NOT NULL CHECK (`status` IN ('open','planned','answered','ignored')),
  `first_seen_at` text NOT NULL,
  `last_seen_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `help_question_insights_status_count_idx` ON `help_question_insights` (`status`,`ask_count`);
--> statement-breakpoint
CREATE INDEX `help_question_insights_last_seen_idx` ON `help_question_insights` (`last_seen_at`);