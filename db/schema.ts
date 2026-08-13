import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const lawFirmApplications = sqliteTable("law_firm_applications", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull(),
  ownerEmail: text("owner_email").notNull(),
  firmName: text("firm_name").notNull(),
  branchName: text("branch_name").notNull().default(""),
  representativeLawyer: text("representative_lawyer").notNull(),
  barRegistrationNumber: text("bar_registration_number").notNull(),
  phone: text("phone").notNull(),
  website: text("website").notNull(),
  address: text("address").notNull(),
  region: text("region").notNull(),
  consultationModes: text("consultation_modes").notNull(),
  introduction: text("introduction").notNull().default(""),
  status: text("status", { enum: ["pending", "verified", "rejected"] }).notNull().default("pending"),
  reviewNote: text("review_note").notNull().default(""),
  verifiedAt: integer("verified_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("law_firm_applications_status_idx").on(table.status, table.verifiedAt),
  index("law_firm_applications_owner_idx").on(table.ownerUserId, table.createdAt),
]);

export const lawFirmExperiences = sqliteTable("law_firm_experiences", {
  id: text("id").primaryKey(),
  applicationId: text("application_id").notNull().references(() => lawFirmApplications.id, { onDelete: "cascade" }),
  evidenceType: text("evidence_type", { enum: ["case_number", "summary"] }).notNull(),
  courtName: text("court_name").notNull().default(""),
  caseNumber: text("case_number").notNull().default(""),
  precedentUrl: text("precedent_url").notNull().default(""),
  eventRegion: text("event_region").notNull().default(""),
  eventMonth: text("event_month").notNull().default(""),
  victimCountBand: text("victim_count_band").notNull().default(""),
  caseCount: integer("case_count").notNull().default(1),
  verificationStatus: text("verification_status", { enum: ["pending", "verified", "rejected"] }).notNull().default("pending"),
}, (table) => [index("law_firm_experiences_application_idx").on(table.applicationId)]);

export const regionalContactCache = sqliteTable("regional_contact_cache", {
  regionKey: text("region_key").primaryKey(),
  region: text("region").notNull(),
  payload: text("payload").notNull(),
  fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});
