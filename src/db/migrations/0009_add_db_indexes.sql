CREATE INDEX `workspace_items_workspace_id_idx` ON `workspace_items` (`workspace_id`);
--> statement-breakpoint
CREATE INDEX `standalone_pages_item_id_idx` ON `standalone_pages` (`item_id`);
--> statement-breakpoint
CREATE INDEX `databases_item_id_idx` ON `databases` (`item_id`);
--> statement-breakpoint
CREATE INDEX `pages_database_id_idx` ON `pages` (`database_id`);
--> statement-breakpoint
CREATE INDEX `account_user_id_idx` ON `account` (`userId`);
--> statement-breakpoint
CREATE INDEX `session_user_id_idx` ON `session` (`userId`);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_members_workspace_user_unique` ON `workspace_members` (`workspace_id`, `user_id`);
--> statement-breakpoint
CREATE INDEX `workspace_members_user_id_idx` ON `workspace_members` (`user_id`);
