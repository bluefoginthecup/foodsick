CREATE TABLE `regional_contact_cache` (
	`region_key` text PRIMARY KEY NOT NULL,
	`region` text NOT NULL,
	`payload` text NOT NULL,
	`fetched_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
