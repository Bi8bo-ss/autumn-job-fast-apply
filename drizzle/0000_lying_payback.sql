CREATE TABLE `application_packs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`job_id` text NOT NULL,
	`resume_version_id` text,
	`content_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resume_version_id`) REFERENCES `resume_versions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_application_packs_user_job` ON `application_packs` (`user_id`,`job_id`);--> statement-breakpoint
CREATE TABLE `custom_answers` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`pack_id` text NOT NULL,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`char_limit` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`pack_id`) REFERENCES `application_packs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_custom_answers_user_pack` ON `custom_answers` (`user_id`,`pack_id`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`company` text NOT NULL,
	`role` text NOT NULL,
	`location` text,
	`jd` text NOT NULL,
	`source_url` text,
	`deadline` text,
	`language` text DEFAULT 'zh' NOT NULL,
	`status` text DEFAULT 'wishlist' NOT NULL,
	`analysis_json` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_jobs_user_status` ON `jobs` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_jobs_user_updated` ON `jobs` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`content_json` text NOT NULL,
	`completeness` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_profiles_user_id` ON `profiles` (`user_id`);--> statement-breakpoint
CREATE TABLE `resume_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`resume_id` text NOT NULL,
	`job_id` text,
	`parent_version_id` text,
	`version_number` integer NOT NULL,
	`content_json` text NOT NULL,
	`source_text` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`resume_id`) REFERENCES `resumes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_resume_versions_resume_number` ON `resume_versions` (`resume_id`,`version_number`);--> statement-breakpoint
CREATE INDEX `idx_resume_versions_user_job` ON `resume_versions` (`user_id`,`job_id`);--> statement-breakpoint
CREATE TABLE `resumes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`language` text DEFAULT 'zh' NOT NULL,
	`source_file_id` text,
	`is_base` integer DEFAULT true NOT NULL,
	`current_version_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`source_file_id`) REFERENCES `stored_files`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_resumes_user_updated` ON `resumes` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `stored_files` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`filename` text NOT NULL,
	`object_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`kind` text NOT NULL,
	`owner_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_stored_files_user_owner` ON `stored_files` (`user_id`,`owner_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_stored_files_object_key` ON `stored_files` (`object_key`);--> statement-breakpoint
CREATE TABLE `tune_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`job_id` text NOT NULL,
	`resume_version_id` text NOT NULL,
	`analysis_json` text NOT NULL,
	`status` text DEFAULT 'processing' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resume_version_id`) REFERENCES `resume_versions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_tune_runs_user_job` ON `tune_runs` (`user_id`,`job_id`);--> statement-breakpoint
CREATE TABLE `tune_suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`run_id` text NOT NULL,
	`section_key` text NOT NULL,
	`original_text` text NOT NULL,
	`proposed_text` text NOT NULL,
	`edited_text` text,
	`rationale` text NOT NULL,
	`matched_requirement` text NOT NULL,
	`needs_user_input` integer DEFAULT false NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `tune_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_tune_suggestions_user_run` ON `tune_suggestions` (`user_id`,`run_id`);