CREATE TABLE `law_firm_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`owner_email` text NOT NULL,
	`firm_name` text NOT NULL,
	`branch_name` text DEFAULT '' NOT NULL,
	`representative_lawyer` text NOT NULL,
	`bar_registration_number` text NOT NULL,
	`phone` text NOT NULL,
	`website` text NOT NULL,
	`address` text NOT NULL,
	`region` text NOT NULL,
	`consultation_modes` text NOT NULL,
	`introduction` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`review_note` text DEFAULT '' NOT NULL,
	`verified_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `law_firm_experiences` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`evidence_type` text NOT NULL,
	`court_name` text DEFAULT '' NOT NULL,
	`case_number` text DEFAULT '' NOT NULL,
	`precedent_url` text DEFAULT '' NOT NULL,
	`event_region` text DEFAULT '' NOT NULL,
	`event_month` text DEFAULT '' NOT NULL,
	`victim_count_band` text DEFAULT '' NOT NULL,
	`case_count` integer DEFAULT 1 NOT NULL,
	`verification_status` text DEFAULT 'pending' NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `law_firm_applications`(`id`) ON UPDATE no action ON DELETE cascade
);
