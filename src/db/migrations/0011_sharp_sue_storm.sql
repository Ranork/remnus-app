CREATE TABLE `agent_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`token_prefix` text NOT NULL,
	`token_hash` text NOT NULL,
	`scope` text NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	`last_used_at` integer,
	`revoked_at` integer,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `agent_tokens_workspace_id_idx` ON `agent_tokens` (`workspace_id`);
--> statement-breakpoint
CREATE INDEX `agent_tokens_token_prefix_idx` ON `agent_tokens` (`token_prefix`);
--> statement-breakpoint
CREATE TABLE `agent_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`token_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`tool` text NOT NULL,
	`target_type` text,
	`target_id` text,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`token_id`) REFERENCES `agent_tokens`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `agent_activity_workspace_id_idx` ON `agent_activity` (`workspace_id`);
--> statement-breakpoint
CREATE INDEX `agent_activity_token_id_idx` ON `agent_activity` (`token_id`);
