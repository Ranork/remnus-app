CREATE TABLE `workspace_items` (
  `id`         text    PRIMARY KEY NOT NULL,
  `type`       text    NOT NULL,
  `title`      text    NOT NULL,
  `parent_id`  text,
  `sort_order` integer NOT NULL DEFAULT 0,
  `created_at` integer NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` integer NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `standalone_pages` (
  `id`         text    PRIMARY KEY NOT NULL,
  `item_id`    text    NOT NULL REFERENCES `workspace_items`(`id`) ON DELETE CASCADE,
  `content`    text    NOT NULL DEFAULT '',
  `created_at` integer NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` integer NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
ALTER TABLE `databases` ADD COLUMN `item_id` text REFERENCES `workspace_items`(`id`) ON DELETE SET NULL;
--> statement-breakpoint
INSERT INTO `workspace_items` (`id`, `type`, `title`, `sort_order`, `created_at`, `updated_at`)
SELECT `id`, 'database', `name`, 0, `created_at`, `updated_at` FROM `databases`;
--> statement-breakpoint
UPDATE `databases` SET `item_id` = `id`;
