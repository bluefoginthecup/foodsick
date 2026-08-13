CREATE INDEX `law_firm_applications_status_idx` ON `law_firm_applications` (`status`,`verified_at`);--> statement-breakpoint
CREATE INDEX `law_firm_applications_owner_idx` ON `law_firm_applications` (`owner_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `law_firm_experiences_application_idx` ON `law_firm_experiences` (`application_id`);