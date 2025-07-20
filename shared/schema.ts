/* -------------------------------------------------------------------------- */
/* Dock Optimizer – unified Drizzle schema                                    */
/* -------------------------------------------------------------------------- */

import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  date,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { ENV } from "./env-helper";

/* ───────────────────────────── Enums / helpers ──────────────────────────── */

export const TenantStatus = {
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  TRIAL: "TRIAL",
  PENDING: "PENDING",
  INACTIVE: "INACTIVE",
} as const;
export type TenantStatus = (typeof TenantStatus)[keyof typeof TenantStatus];

export const AvailableModule = {
  APPOINTMENTS: "appointments",
  CALENDAR: "calendar",
  ASSET_MANAGER: "companyAssets",
  EMAIL_NOTIFICATIONS: "emailNotifications",
  ANALYTICS: "analytics",
  BOOKING_PAGES: "bookingPages",
  FACILITY_MANAGEMENT: "facilityManagement",
  DOOR_MANAGER: "doorManager",
  USER_MANAGEMENT: "userManagement",
} as const;
export type AvailableModule =
  (typeof AvailableModule)[keyof typeof AvailableModule];

export enum RoleName {
  super_admin = "super-admin",
  admin = "admin",
  manager = "manager",
  facility_manager = "facility-manager",
  staff = "staff",
  facility_staff = "facility-staff",
  maintenance = "maintenance",
  worker = "worker",
}
export type Role = RoleName | string;

export const ScheduleType = {
  INBOUND: "inbound",
  OUTBOUND: "outbound",
} as const;
export const FieldType = {
  TEXT: "text",
  TEXTAREA: "textarea",
  SELECT: "select",
  RADIO: "radio",
  CHECKBOX: "checkbox",
  FILE: "file",
  NUMBER: "number",
  EMAIL: "email",
  PHONE: "phone",
  DATE: "date",
} as const;
export const ScheduleStatus = {
  SCHEDULED: "scheduled",
  IN_PROGRESS: "in-progress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;
export const DockStatus = {
  AVAILABLE: "available",
  OCCUPIED: "occupied",
  RESERVED: "reserved",
  MAINTENANCE: "maintenance",
} as const;
export const HolidayScope = {
  FACILITY: "facility",
  ORGANIZATION: "organization",
} as const;
export const TimeInterval = {
  MINUTES_15: 15,
  MINUTES_30: 30,
  MINUTES_60: 60,
} as const;

/* ───────────────────────────── Core reference tables ────────────────────── */

export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertRoleSchema = createInsertSchema(roles).omit({
  id: true,
  createdAt: true,
});

export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  subdomain: text("subdomain").notNull().unique(),
  status: text("status").$type<TenantStatus>().default(TenantStatus.ACTIVE),
  primaryContact: text("primary_contact"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  billingEmail: text("billing_email"),
  billingAddress: text("billing_address"),
  subscription: text("subscription").default("basic"),
  planStartDate: date("plan_start_date"),
  planEndDate: date("plan_end_date"),
  timezone: text("timezone").default("America/New_York"),
  logo: text("logo_url"),
  settings: jsonb("settings").default({}),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: integer("created_by"),
  updatedBy: integer("updated_by"),
});
export const insertTenantSchema = createInsertSchema(tenants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  role: text("role").notNull().$type<Role>(),
  tenantId: integer("tenant_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

/* ───────────────────────────── Facilities & docks ───────────────────────── */

export type DoorType =
  | "dry"
  | "refrigerated"
  | "frozen"
  | "hazmat"
  | "extra_heavy"
  | "custom";

export const facilities = pgTable("facilities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address1: text("address1").notNull(),
  address2: text("address2"),
  city: text("city").notNull(),
  state: text("state").notNull(),
  pincode: text("pincode").notNull(),
  country: text("country").notNull(),
  latitude: text("latitude"),
  longitude: text("longitude"),
  company: text("company"),
  timezone: text("timezone").default("America/New_York"),
  tenantId: integer("tenant_id"),
  /* business-hours columns unchanged … */
  mondayStart: text("monday_start").default("08:00"),
  mondayEnd: text("monday_end").default("17:00"),
  /* … rest of weekday columns … */
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastModifiedAt: timestamp("last_modified_at"),
});

export const docks = pgTable("docks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  facilityId: integer("facility_id").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  type: text("type").notNull().$type<DoorType>(),
  customType: text("custom_type"),
  constraints: jsonb("constraints"),
});
export const carriers = pgTable("carriers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  mcNumber: text("mc_number"),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
});

/* ───────────────────────────── Scheduling / BOL docs ────────────────────── */

export const schedules = pgTable("schedules", {
  id: serial("id").primaryKey(),
  facilityId: integer("facility_id"),
  dockId: integer("dock_id"),
  carrierId: integer("carrier_id"),
  appointmentTypeId: integer("appointment_type_id"),
  /* existing columns unchanged … */
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull(),
  /* meta */
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastModifiedAt: timestamp("last_modified_at"),
});

/* ----  BOL documents (legacy cols kept nullable) ---- */
export const bolDocuments = pgTable("bol_documents", {
  id: serial("id").primaryKey(),
  scheduleId: integer("schedule_id"), // now nullable
  fileKey: text("file_key"),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  pageCount: integer("page_count"),
  compressedImage: text("compressed_image"),
  imageMetadata: jsonb("image_metadata"),
  /* legacy */
  originalFileName: text("original_file_name"),
  filePath: text("file_path"),
  fileSize: integer("file_size"),
  tenantId: integer("tenant_id"),
  ocrData: jsonb("ocr_data"),
  parsedData: jsonb("parsed_data"),
  ocrStatus: text("ocr_status"),
  updatedAt: timestamp("updated_at"),
  /* new */
  uploadedBy: integer("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ---- appointment ↔ BOL link ---- */
export const appointmentBolLinks = pgTable("appointment_bol_links", {
  id: serial("id").primaryKey(),
  appointmentId: integer("appointment_id")
    .notNull()
    .references(() => schedules.id, { onDelete: "cascade" }),
  bolDocumentId: integer("bol_document_id")
    .notNull()
    .references(() => bolDocuments.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

/* ───────────────────────────── Notifications / prefs ────────────────────── */

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  type: text("type").notNull(),
  relatedScheduleId: integer("related_schedule_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const userPreferences = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  organizationId: integer("organization_id").notNull(),
  emailNotificationsEnabled: boolean("email_notifications_enabled")
    .default(true)
    .notNull(),
  /* … other prefs unchanged … */
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at"),
});

/* ───────────────────────────── Appointment settings/types ───────────────── */

export const appointmentSettings = pgTable("appointment_settings", {
  id: serial("id").primaryKey(),
  timeInterval: integer("time_interval")
    .default(TimeInterval.MINUTES_30)
    .notNull(),
  /* … remainder unchanged … */
  facilityId: integer("facility_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastModifiedAt: timestamp("last_modified_at"),
});

export const appointmentTypes = pgTable("appointment_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  facilityId: integer("facility_id").notNull(),
  duration: integer("duration").notNull(),
  /* … other columns … */
  tenantId: integer("tenant_id").references(() => tenants.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastModifiedAt: timestamp("last_modified_at"),
});

/* dailyAvailability, customQuestions, standardQuestions  (unchanged)  */
/* —> added legacy 'options' column back to standardQuestions          */

export const standardQuestions = pgTable("standard_questions", {
  id: serial("id").primaryKey(),
  appointmentTypeId: integer("appointment_type_id").notNull(),
  fieldKey: text("field_key").notNull(),
  label: text("label").notNull(),
  fieldType: text("field_type").notNull(),
  included: boolean("included").default(true).notNull(),
  required: boolean("required").default(false).notNull(),
  orderPosition: integer("order_position").notNull(),
  /* legacy multiple-choice options */
  options: jsonb("options"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ───────────────────────────── Booking pages ────────────────────────────── */

export const bookingPages = pgTable("booking_pages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  /* other cols unchanged */
  tenantId: integer("tenant_id"),
  createdBy: integer("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastModifiedAt: timestamp("last_modified_at"),
  lastModifiedBy: integer("last_modified_by"),
});

/* ───────────────────────────── Asset manager tables ─────────────────────── */

export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  /* … unchanged … */
  lastAccessedAt: timestamp("last_accessed_at"),
});

export const companyAssets = pgTable("company_assets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  /* your new columns … */
  implementationDate: date("implementation_date"),
  /* legacy cols kept so drizzle won’t delete data */
  implemented_date: date("implemented_date"),
  last_service_date: date("last_service_date"),
  next_service_date: date("next_service_date"),
  /* … rest unchanged … */
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/* file_storage (unchanged)                                                  */

/* ───────────────────────────── Org mapping tables ───────────────────────── */

export const organizationUsers = pgTable(
  "organization_users",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow(), // ← added
  },
  (t) => ({ orgUserUnique: unique().on(t.organizationId, t.userId) }),
);

export const organizationModules = pgTable(
  "organization_modules",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    moduleName: text("module_name").notNull(),
    enabled: boolean("enabled").default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow(), // ← added
  },
  (t) => ({ orgModuleUnique: unique().on(t.organizationId, t.moduleName) }),
);

export const organizationFacilities = pgTable(
  "organization_facilities",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: integer("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({ orgFacilityUnique: unique().on(t.organizationId, t.facilityId) }),
);

/* activity_logs, user_preferences, etc. unchanged aside from updatedAt cols */

/* ───────────────────────────── Legacy / support tables ──────────────────── */

/* Session store the app still touches */
export const session = pgTable("session", {
  sid: text("sid").primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire").notNull(),
});

/* OCR analytics history */
export const ocrAnalytics = pgTable("ocr_analytics", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  fileKey: text("file_key").notNull(),
  rawText: text("raw_text"),
  parsedData: jsonb("parsed_data"),
  backend: text("backend").default("tesseract"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* facility_hours – older UI still queries this */
export const facilityHours = pgTable("facility_hours", {
  id: serial("id").primaryKey(),
  facilityId: integer("facility_id").notNull(),
  dayOfWeek: integer("day_of_week").notNull(),
  isOpen: boolean("is_open").default(false).notNull(),
  openTime: text("open_time").default("08:00"),
  closeTime: text("close_time").default("17:00"),
  breakStart: text("break_start"),
  breakEnd: text("break_end"),
});

/* ───────────────────────────── Relations (unchanged) ────────────────────── */
/* Keep exactly the relation blocks you already had – they still compile.    */

/* ───────────────────────────── Types export (unchanged) ─────────────────── */

export type Tenant = typeof tenants.$inferSelect;
export type FeatureFlag = {
  id: number;
  tenantId: number;
  module: AvailableModule;
  enabled: boolean;
};

/* -------------------------------------------------------------------------- */
/* End of schema – the rest of your generated types / insert schemas remain  */
/* exactly as before (copy from original file if needed).                    */
/* -------------------------------------------------------------------------- */
