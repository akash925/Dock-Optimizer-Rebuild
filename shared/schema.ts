import { pgTable, text, serial, integer, boolean, timestamp, jsonb, date, varchar, unique, decimal } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { ENV } from "./env-helper";

// Import custom schema files
import { ocrAnalytics, OcrAnalytics, InsertOcrAnalytics } from "../drizzle/schema/ocr_analytics";

// Tenant status enum
export const TenantStatus = {
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  TRIAL: "TRIAL",
  PENDING: "PENDING",
  INACTIVE: "INACTIVE",
} as const;

export type TenantStatus = (typeof TenantStatus)[keyof typeof TenantStatus];

// Available modules that can be enabled per tenant
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

export type AvailableModule = (typeof AvailableModule)[keyof typeof AvailableModule];

// User Roles
export enum RoleName {
  super_admin       = "super-admin",
  admin             = "admin",
  manager           = "manager",
  facility_manager  = "facility-manager",
  staff             = "staff",
  facility_staff    = "facility-staff",
  maintenance       = "maintenance",
  worker            = "worker"
}

export type Role = RoleName | string;

// Role model for more granular permissions
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

export type RoleRecord = typeof roles.$inferSelect;
export type InsertRoleRecord = z.infer<typeof insertRoleSchema>;

// Enum for Schedule Type
export const ScheduleType = {
  INBOUND: "inbound",
  OUTBOUND: "outbound",
} as const;

// Enum for Field Type
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

// Enum for Schedule Status
export const ScheduleStatus = {
  SCHEDULED: "scheduled",
  IN_PROGRESS: "in-progress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

// Enum for Dock Status
export const DockStatus = {
  AVAILABLE: "available",
  OCCUPIED: "occupied",
  RESERVED: "reserved",
  MAINTENANCE: "maintenance",
} as const;

// Enum for Notification Type
export const NotificationType = {
  SCHEDULE_CHANGE: "schedule-change",
  DELAY: "delay",
  UPCOMING_ARRIVAL: "upcoming-arrival",
  SYSTEM: "system",
} as const;

// Enum for Holiday Scope
export const HolidayScope = {
  FACILITY: "facility",
  ORGANIZATION: "organization",
} as const;

// Enum for Time Intervals
export const TimeInterval = {
  MINUTES_15: 15,
  MINUTES_30: 30,
  MINUTES_60: 60,
} as const;

// User Model
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  role: text("role").notNull().$type<Role>(),
  // Adding tenant support
  tenantId: integer("tenant_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

// Dock/Door Types
export type DoorType = "dry" | "refrigerated" | "frozen" | "hazmat" | "extra_heavy" | "custom";

// Dock Model
export const docks = pgTable("docks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  facilityId: integer("facility_id").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  type: text("type").notNull().$type<DoorType>(), // Door type (dry, refrigerated, etc)
  customType: text("custom_type"), // For custom door types
  constraints: jsonb("constraints"), // Store constraints like door height, trailer length, etc.
});

export const insertDockSchema = createInsertSchema(docks).omit({
  id: true,
});

// Carrier Model
export const carriers = pgTable("carriers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  mcNumber: text("mc_number"), // Motor Carrier number
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
});

export const insertCarrierSchema = createInsertSchema(carriers).omit({
  id: true,
});

// Schedule Model
export const schedules = pgTable("schedules", {
  id: serial("id").primaryKey(),
  facilityId: integer("facility_id"), // Adding facility ID field
  dockId: integer("dock_id"),
  carrierId: integer("carrier_id"), // Removing .notNull() to allow null carriers
  appointmentTypeId: integer("appointment_type_id"),
  truckNumber: text("truck_number"),
  trailerNumber: text("trailer_number"),
  driverName: text("driver_name"),
  driverPhone: text("driver_phone"),
  driverEmail: text("driver_email"),
  customerName: text("customer_name"),
  carrierName: text("carrier_name"),
  mcNumber: text("mc_number"),
  bolNumber: text("bol_number"), // Free text field for BOL (can contain text and numbers)
  poNumber: text("po_number"),
  palletCount: text("pallet_count"),
  weight: text("weight"),
  appointmentMode: text("appointment_mode").default("trailer"), // trailer or container
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  actualStartTime: timestamp("actual_start_time"),
  actualEndTime: timestamp("actual_end_time"),
  type: text("type").notNull(), // inbound or outbound
  status: text("status").notNull(), // scheduled, in-progress, completed, cancelled
  notes: text("notes"),
  releaseImage: text("release_image"), // Base64 encoded release/checkout photo
  releaseImageMetadata: jsonb("release_image_metadata"), // Release image metadata
  customFormData: jsonb("custom_form_data"), // Stores responses to custom questions
  creatorEmail: text("creator_email"), // Email of the person who created the appointment (for external bookings)
  createdBy: integer("created_by"), // User ID who created the schedule
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastModifiedAt: timestamp("last_modified_at"),
  lastModifiedBy: integer("last_modified_by"),
  confirmationCode: text("confirmation_code"), // Added confirmation code
});

// Create a base schema using drizzle-zod
const baseInsertScheduleSchema = createInsertSchema(schedules).omit({
  id: true,
  createdAt: true,
  lastModifiedAt: true,
});

// Enhance the schema to handle date strings for startTime and endTime
export const insertScheduleSchema = baseInsertScheduleSchema.extend({
  startTime: z.string().or(z.date()).transform((val) => {
    if (typeof val === 'string') {
      return new Date(val);
    }
    return val;
  }),
  endTime: z.string().or(z.date()).transform((val) => {
    if (typeof val === 'string') {
      return new Date(val);
    } 
    return val;
  }),
});

// BOL Documents table - for Bills of Lading associated with schedules
export const bolDocuments = pgTable("bol_documents", {
  id: serial("id").primaryKey(),
  scheduleId: integer("schedule_id").notNull().references(() => schedules.id, { onDelete: "cascade" }),
  fileKey: text("file_key").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  pageCount: integer("page_count"),
  compressedImage: text("compressed_image"), // Base64 encoded BOL document image
  imageMetadata: jsonb("image_metadata"), // BOL document image metadata
  uploadedBy: integer("uploaded_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBolDocumentSchema = createInsertSchema(bolDocuments).omit({
  id: true,
  createdAt: true,
});

export type BolDocument = typeof bolDocuments.$inferSelect;
export type InsertBolDocument = z.infer<typeof insertBolDocumentSchema>;

// Appointment BOL Links table - for linking BOL documents to appointments/schedules
export const appointmentBolLinks = pgTable('appointment_bol_links', {
  id: serial('id').primaryKey(),
  appointmentId: integer('appointment_id').notNull().references(() => schedules.id, { onDelete: 'cascade' }),
  bolDocumentId: integer('bol_document_id').notNull().references(() => bolDocuments.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const insertAppointmentBolLinkSchema = createInsertSchema(appointmentBolLinks).omit({
  id: true,
  createdAt: true,
});

export type AppointmentBolLink = typeof appointmentBolLinks.$inferSelect;
export type InsertAppointmentBolLink = z.infer<typeof insertAppointmentBolLinkSchema>;

// Notification Model
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  type: text("type").notNull(), // e.g., schedule-change, delay, upcoming-arrival
  relatedScheduleId: integer("related_schedule_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
  isRead: true,
});

// User Notification Preferences Model
export const userPreferences = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  organizationId: integer("organization_id").notNull(),
  // Email notification preferences
  emailNotificationsEnabled: boolean("email_notifications_enabled").notNull().default(true),
  emailScheduleChanges: boolean("email_schedule_changes").notNull().default(true),
  emailTruckArrivals: boolean("email_truck_arrivals").notNull().default(true),
  emailDockAssignments: boolean("email_dock_assignments").notNull().default(true),
  emailWeeklyReports: boolean("email_weekly_reports").notNull().default(false),
  // Push notification preferences
  pushNotificationsEnabled: boolean("push_notifications_enabled").notNull().default(true),
  pushUrgentAlertsOnly: boolean("push_urgent_alerts_only").notNull().default(true),
  pushAllUpdates: boolean("push_all_updates").notNull().default(false),
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at"),
});

export const insertUserPreferencesSchema = createInsertSchema(userPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type UserPreferences = typeof userPreferences.$inferSelect;
export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;

// Facility Model
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
  timezone: text("timezone").default("America/New_York"), // Default to Eastern Time
  tenantId: integer("tenant_id"), // Added for multi-tenant isolation
  
  // Operating hours for the facility - all times stored in 24-hour format HH:MM
  mondayStart: text("monday_start").default("08:00"),
  mondayEnd: text("monday_end").default("17:00"),
  mondayBreakStart: text("monday_break_start").default("12:00"),
  mondayBreakEnd: text("monday_break_end").default("13:00"),
  mondayOpen: boolean("monday_open").default(true),
  
  tuesdayStart: text("tuesday_start").default("08:00"),
  tuesdayEnd: text("tuesday_end").default("17:00"),
  tuesdayBreakStart: text("tuesday_break_start").default("12:00"),
  tuesdayBreakEnd: text("tuesday_break_end").default("13:00"),
  tuesdayOpen: boolean("tuesday_open").default(true),
  
  wednesdayStart: text("wednesday_start").default("08:00"),
  wednesdayEnd: text("wednesday_end").default("17:00"),
  wednesdayBreakStart: text("wednesday_break_start").default("12:00"),
  wednesdayBreakEnd: text("wednesday_break_end").default("13:00"),
  wednesdayOpen: boolean("wednesday_open").default(true),
  
  thursdayStart: text("thursday_start").default("08:00"),
  thursdayEnd: text("thursday_end").default("17:00"),
  thursdayBreakStart: text("thursday_break_start").default("12:00"),
  thursdayBreakEnd: text("thursday_break_end").default("13:00"),
  thursdayOpen: boolean("thursday_open").default(true),
  
  fridayStart: text("friday_start").default("08:00"),
  fridayEnd: text("friday_end").default("17:00"),
  fridayBreakStart: text("friday_break_start").default("12:00"),
  fridayBreakEnd: text("friday_break_end").default("13:00"),
  fridayOpen: boolean("friday_open").default(true),
  
  saturdayStart: text("saturday_start").default("08:00"),
  saturdayEnd: text("saturday_end").default("13:00"),
  saturdayBreakStart: text("saturday_break_start"),
  saturdayBreakEnd: text("saturday_break_end"),
  saturdayOpen: boolean("saturday_open").default(false),
  
  sundayStart: text("sunday_start").default("08:00"),
  sundayEnd: text("sunday_end").default("17:00"),
  sundayBreakStart: text("sunday_break_start"),
  sundayBreakEnd: text("sunday_break_end"),
  sundayOpen: boolean("sunday_open").default(false),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastModifiedAt: timestamp("last_modified_at"),
});

export const insertFacilitySchema = createInsertSchema(facilities).omit({
  id: true,
  createdAt: true,
  lastModifiedAt: true,
});

// Holiday Model
export const holidays = pgTable("holidays", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  description: text("description").notNull(),
  scope: text("scope").notNull().$type<keyof typeof HolidayScope>(), // facility or organization
  facilityId: integer("facility_id"), // null if organization-wide
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastModifiedAt: timestamp("last_modified_at"),
});

export const insertHolidaySchema = createInsertSchema(holidays).omit({
  id: true,
  createdAt: true,
  lastModifiedAt: true,
});



// Appointment Settings Model
export const appointmentSettings = pgTable("appointment_settings", {
  id: serial("id").primaryKey(),
  // Time slot settings
  timeInterval: integer("time_interval").notNull().default(TimeInterval.MINUTES_30),
  maxConcurrentInbound: integer("max_concurrent_inbound").notNull().default(2),
  maxConcurrentOutbound: integer("max_concurrent_outbound").notNull().default(2),
  shareAvailabilityInfo: boolean("share_availability_info").notNull().default(true),
  
  // Facility-specific availability rules
  sunday: boolean("sunday").notNull().default(false),
  monday: boolean("monday").notNull().default(true),
  tuesday: boolean("tuesday").notNull().default(true),
  wednesday: boolean("wednesday").notNull().default(true),
  thursday: boolean("thursday").notNull().default(true),
  friday: boolean("friday").notNull().default(true),
  saturday: boolean("saturday").notNull().default(false),
  
  // Daily time windows - using environment variables for defaults
  sundayStartTime: text("sunday_start_time").default(ENV.DEFAULT_START_TIME),
  sundayEndTime: text("sunday_end_time").default(ENV.DEFAULT_END_TIME),
  mondayStartTime: text("monday_start_time").default(ENV.DEFAULT_START_TIME),
  mondayEndTime: text("monday_end_time").default(ENV.DEFAULT_END_TIME),
  tuesdayStartTime: text("tuesday_start_time").default(ENV.DEFAULT_START_TIME),
  tuesdayEndTime: text("tuesday_end_time").default(ENV.DEFAULT_END_TIME),
  wednesdayStartTime: text("wednesday_start_time").default(ENV.DEFAULT_START_TIME),
  wednesdayEndTime: text("wednesday_end_time").default(ENV.DEFAULT_END_TIME),
  thursdayStartTime: text("thursday_start_time").default(ENV.DEFAULT_START_TIME),
  thursdayEndTime: text("thursday_end_time").default(ENV.DEFAULT_END_TIME),
  fridayStartTime: text("friday_start_time").default(ENV.DEFAULT_START_TIME),
  fridayEndTime: text("friday_end_time").default(ENV.DEFAULT_END_TIME),
  saturdayStartTime: text("saturday_start_time").default(ENV.DEFAULT_START_TIME),
  saturdayEndTime: text("saturday_end_time").default(ENV.DEFAULT_END_TIME),
  
  // Lunch/break periods - configurable defaults
  sundayBreakStartTime: text("sunday_break_start_time").default(ENV.DEFAULT_BREAK_START),
  sundayBreakEndTime: text("sunday_break_end_time").default(ENV.DEFAULT_BREAK_END),
  mondayBreakStartTime: text("monday_break_start_time").default(ENV.DEFAULT_BREAK_START),
  mondayBreakEndTime: text("monday_break_end_time").default(ENV.DEFAULT_BREAK_END),
  tuesdayBreakStartTime: text("tuesday_break_start_time").default(ENV.DEFAULT_BREAK_START),
  tuesdayBreakEndTime: text("tuesday_break_end_time").default(ENV.DEFAULT_BREAK_END),
  wednesdayBreakStartTime: text("wednesday_break_start_time").default(ENV.DEFAULT_BREAK_START),
  wednesdayBreakEndTime: text("wednesday_break_end_time").default(ENV.DEFAULT_BREAK_END),
  thursdayBreakStartTime: text("thursday_break_start_time").default(ENV.DEFAULT_BREAK_START),
  thursdayBreakEndTime: text("thursday_break_end_time").default(ENV.DEFAULT_BREAK_END),
  fridayBreakStartTime: text("friday_break_start_time").default(ENV.DEFAULT_BREAK_START),
  fridayBreakEndTime: text("friday_break_end_time").default(ENV.DEFAULT_BREAK_END),
  saturdayBreakStartTime: text("saturday_break_start_time").default(ENV.DEFAULT_BREAK_START),
  saturdayBreakEndTime: text("saturday_break_end_time").default(ENV.DEFAULT_BREAK_END),
  
  // Max appointments per day for the entire facility
  sundayMaxAppointments: integer("sunday_max_appointments").default(0), // 0 = unlimited
  mondayMaxAppointments: integer("monday_max_appointments").default(0),
  tuesdayMaxAppointments: integer("tuesday_max_appointments").default(0),
  wednesdayMaxAppointments: integer("wednesday_max_appointments").default(0),
  thursdayMaxAppointments: integer("thursday_max_appointments").default(0),
  fridayMaxAppointments: integer("friday_max_appointments").default(0),
  saturdayMaxAppointments: integer("saturday_max_appointments").default(0),
  
  // Default values for new appointment types - configurable
  defaultBufferTime: integer("default_buffer_time").notNull().default(ENV.DEFAULT_BUFFER_TIME), // minutes between appointments
  defaultGracePeriod: integer("default_grace_period").notNull().default(ENV.DEFAULT_GRACE_PERIOD), // minutes before marked late
  defaultEmailReminderTime: integer("default_email_reminder_time").notNull().default(ENV.DEFAULT_EMAIL_REMINDER_HOURS), // hours
  allowAppointmentsThroughBreaks: boolean("allow_appointments_through_breaks").notNull().default(false),
  allowAppointmentsPastBusinessHours: boolean("allow_appointments_past_business_hours").notNull().default(false),
  
  facilityId: integer("facility_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastModifiedAt: timestamp("last_modified_at"),
});

export const insertAppointmentSettingsSchema = createInsertSchema(appointmentSettings).omit({
  id: true,
  createdAt: true,
  lastModifiedAt: true,
});

// Appointment Type Model
export const appointmentTypes = pgTable("appointment_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  facilityId: integer("facility_id").notNull(),
  duration: integer("duration").notNull(), // in minutes
  color: text("color").notNull(),
  type: text("type").notNull().$type<keyof typeof ScheduleType>(), // inbound or outbound
  showRemainingSlots: boolean("show_remaining_slots").notNull().default(true),
  gracePeriod: integer("grace_period").notNull().default(ENV.DEFAULT_GRACE_PERIOD), // in minutes - before an appointment is marked late
  bufferTime: integer("buffer_time").notNull().default(ENV.DEFAULT_BUFFER_TIME), // in minutes - gap between appointments
  maxAppointmentsPerDay: integer("max_appointments_per_day"), // optional limit for total daily appointments
  maxConcurrent: integer("max_concurrent").notNull().default(ENV.DEFAULT_MAX_CONCURRENT), // maximum parallel appointments of this type
  emailReminderTime: integer("email_reminder_time").notNull().default(ENV.DEFAULT_EMAIL_REMINDER_HOURS), // hours before appointment
  allowAppointmentsThroughBreaks: boolean("allow_appointments_through_breaks").notNull().default(false),
  allowAppointmentsPastBusinessHours: boolean("allow_appointments_past_business_hours").notNull().default(false),
  overrideFacilityHours: boolean("override_facility_hours").notNull().default(false), // When true, allow scheduling outside facility hours
  timezone: text("timezone").default(ENV.DEFAULT_FACILITY_TIMEZONE), // Configurable default timezone
  tenantId: integer("tenant_id").references(() => tenants.id), // Foreign key to tenants table
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastModifiedAt: timestamp("last_modified_at"),
});

export const insertAppointmentTypeSchema = createInsertSchema(appointmentTypes).omit({
  id: true,
  createdAt: true,
  lastModifiedAt: true,
});

// Daily Availability Model - for day-specific settings
export const dailyAvailability = pgTable("daily_availability", {
  id: serial("id").primaryKey(),
  appointmentTypeId: integer("appointment_type_id").notNull(),
  dayOfWeek: integer("day_of_week").notNull(), // 0-6 for Sunday-Saturday
  isAvailable: boolean("is_available").notNull().default(true),
  maxAppointments: integer("max_appointments").notNull().default(0),
  startTime: text("start_time").notNull().default("08:00"),
  endTime: text("end_time").notNull().default("17:00"),
  breakStartTime: text("break_start_time").default("12:00"),
  breakEndTime: text("break_end_time").default("13:00"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDailyAvailabilitySchema = createInsertSchema(dailyAvailability).omit({
  id: true,
  createdAt: true,
});

// Custom Form Question Model
export const customQuestions = pgTable("custom_questions", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  type: text("type").notNull().$type<keyof typeof FieldType>(),
  isRequired: boolean("is_required").notNull().default(false),
  placeholder: text("placeholder"),
  options: jsonb("options"), // for select, radio, checkbox
  defaultValue: text("default_value"),
  order: integer("order_position").notNull(),
  appointmentTypeId: integer("appointment_type_id"), // If null, applies to all types
  applicableType: text("applicable_type").$type<keyof typeof ScheduleType | "both">().default("both"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastModifiedAt: timestamp("last_modified_at"),
});

export const insertCustomQuestionSchema = createInsertSchema(customQuestions).omit({
  id: true,
  createdAt: true,
  lastModifiedAt: true,
});

// Define relations
export const usersRelations = relations(users, ({ many, one }) => ({
  createdSchedules: many(schedules, { relationName: "user_created_schedules" }),
  modifiedSchedules: many(schedules, { relationName: "user_modified_schedules" }),
  notifications: many(notifications),
  preferences: many(userPreferences),
  // Adding tenant relation for multi-tenancy
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
  // Organization memberships
  organizationUsers: many(organizationUsers),
}));

// Role relations
export const rolesRelations = relations(roles, ({ many }) => ({
  organizationUsers: many(organizationUsers),
}));

// Organization Users relations - we'll define this after the schema is complete to avoid circular references
// Will be defined at the end of the file

// Organization Modules relations - defined after all schemas to avoid circular references
// Will be defined at the end of the file

export const docksRelations = relations(docks, ({ many, one }) => ({
  schedules: many(schedules, { relationName: "dock_schedules" }),
  facility: one(facilities, {
    fields: [docks.facilityId],
    references: [facilities.id],
  }),
}));

export const carriersRelations = relations(carriers, ({ many }) => ({
  schedules: many(schedules),
}));

export const schedulesRelations = relations(schedules, ({ one, many }) => ({
  dock: one(docks, {
    fields: [schedules.dockId],
    references: [docks.id],
    relationName: "dock_schedules",
  }),
  facility: one(facilities, {
    fields: [schedules.facilityId],
    references: [facilities.id],
    relationName: "facility_schedules",
  }),
  carrier: one(carriers, {
    fields: [schedules.carrierId],
    references: [carriers.id],
  }),
  appointmentType: one(appointmentTypes, {
    fields: [schedules.appointmentTypeId],
    references: [appointmentTypes.id],
  }),
  creator: one(users, {
    fields: [schedules.createdBy],
    references: [users.id],
    relationName: "user_created_schedules"
  }),
  modifier: one(users, {
    fields: [schedules.lastModifiedBy],
    references: [users.id],
    relationName: "user_modified_schedules"
  }),
  notifications: many(notifications)
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  schedule: one(schedules, {
    fields: [notifications.relatedScheduleId],
    references: [schedules.id],
  }),
}));

export const facilitiesRelations = relations(facilities, ({ many }) => ({
  docks: many(docks),
  schedules: many(schedules, { relationName: "facility_schedules" }),
  holidays: many(holidays, { relationName: "facility_holidays" }),
  appointmentSettings: many(appointmentSettings, { relationName: "facility_appointment_settings" }),
  appointmentTypes: many(appointmentTypes, { relationName: "facility_appointment_types" }),
}));

export const appointmentSettingsRelations = relations(appointmentSettings, ({ one }) => ({
  facility: one(facilities, {
    fields: [appointmentSettings.facilityId],
    references: [facilities.id],
    relationName: "facility_appointment_settings"
  }),
}));

export const holidaysRelations = relations(holidays, ({ one }) => ({
  facility: one(facilities, {
    fields: [holidays.facilityId],
    references: [facilities.id],
    relationName: "facility_holidays"
  }),
}));

export const appointmentTypesRelations = relations(appointmentTypes, ({ one, many }) => ({
  facility: one(facilities, {
    fields: [appointmentTypes.facilityId],
    references: [facilities.id],
    relationName: "facility_appointment_types"
  }),
  tenant: one(tenants, {
    fields: [appointmentTypes.tenantId],
    references: [tenants.id],
  }),
  dailyAvailability: many(dailyAvailability),
  customQuestions: many(customQuestions),
  standardQuestions: many(standardQuestions, { relationName: "appointment_type_standard_questions" }),
  schedules: many(schedules)
}));

export const dailyAvailabilityRelations = relations(dailyAvailability, ({ one }) => ({
  appointmentType: one(appointmentTypes, {
    fields: [dailyAvailability.appointmentTypeId],
    references: [appointmentTypes.id]
  })
}));

export const customQuestionsRelations = relations(customQuestions, ({ one }) => ({
  appointmentType: one(appointmentTypes, {
    fields: [customQuestions.appointmentTypeId],
    references: [appointmentTypes.id],
    relationName: "appointment_type_questions"
  })
}));

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Dock = typeof docks.$inferSelect;
export type InsertDock = z.infer<typeof insertDockSchema>;

export type Schedule = typeof schedules.$inferSelect;
export type InsertSchedule = z.infer<typeof insertScheduleSchema>;

export type Carrier = typeof carriers.$inferSelect;
export type InsertCarrier = z.infer<typeof insertCarrierSchema>;

export type Facility = typeof facilities.$inferSelect;
export type InsertFacility = z.infer<typeof insertFacilitySchema>;

export type Holiday = typeof holidays.$inferSelect;
export type InsertHoliday = z.infer<typeof insertHolidaySchema>;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export type AppointmentSettings = typeof appointmentSettings.$inferSelect;
export type InsertAppointmentSettings = z.infer<typeof insertAppointmentSettingsSchema>;

export type AppointmentType = typeof appointmentTypes.$inferSelect;
export type InsertAppointmentType = z.infer<typeof insertAppointmentTypeSchema>;

export type DailyAvailability = typeof dailyAvailability.$inferSelect;
export type InsertDailyAvailability = z.infer<typeof insertDailyAvailabilitySchema>;

// Booking Page Model (External public booking pages)
export const bookingPages = pgTable("booking_pages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(), // URL-friendly identifier
  title: text("title").notNull(), // Page title/heading
  description: text("description"), // Description text
  welcomeMessage: text("welcome_message"), // Message shown at top of booking form
  confirmationMessage: text("confirmation_message"), // Shown after successful booking
  isActive: boolean("is_active").notNull().default(true),
  facilities: jsonb("facilities").notNull(), // JSON array of facility IDs included on this page
  excludedAppointmentTypes: jsonb("excluded_appointment_types"), // JSON array of appointment types to exclude
  useOrganizationLogo: boolean("use_organization_logo").notNull().default(true), // Whether to show the org logo
  customLogo: text("custom_logo"), // URL to custom logo if not using org logo
  primaryColor: text("primary_color").default("#4CAF50"), // Theme color
  tenantId: integer("tenant_id"), // Added for multi-tenant isolation
  createdBy: integer("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastModifiedAt: timestamp("last_modified_at"),
  lastModifiedBy: integer("last_modified_by"),
});

export const insertBookingPageSchema = createInsertSchema(bookingPages).omit({
  id: true,
  createdAt: true,
  lastModifiedAt: true,
});

export const bookingPagesRelations = relations(bookingPages, ({ one }) => ({
  creator: one(users, {
    fields: [bookingPages.createdBy],
    references: [users.id],
  }),
  modifier: one(users, {
    fields: [bookingPages.lastModifiedBy],
    references: [users.id],
  }),
  tenant: one(tenants, {
    fields: [bookingPages.tenantId],
    references: [tenants.id],
  }),
}));

export type BookingPage = typeof bookingPages.$inferSelect;
export type InsertBookingPage = z.infer<typeof insertBookingPageSchema>;

// Standard Questions Model (for appointment type standard fields configuration)
export const standardQuestions = pgTable("standard_questions", {
  id: serial("id").primaryKey(),
  appointmentTypeId: integer("appointment_type_id").notNull(),
  fieldKey: text("field_key").notNull(), // e.g. customerName, carrierName, etc.
  label: text("label").notNull(), // Display name
  fieldType: text("field_type").notNull().$type<keyof typeof FieldType>(),
  included: boolean("included").notNull().default(true),
  required: boolean("required").notNull().default(false),
  orderPosition: integer("order_position").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertStandardQuestionSchema = createInsertSchema(standardQuestions).omit({
  id: true,
  createdAt: true,
});

export const standardQuestionsRelations = relations(standardQuestions, ({ one }) => ({
  appointmentType: one(appointmentTypes, {
    fields: [standardQuestions.appointmentTypeId],
    references: [appointmentTypes.id],
    relationName: "appointment_type_standard_questions"
  })
}));

export type CustomQuestion = typeof customQuestions.$inferSelect;
export type InsertCustomQuestion = z.infer<typeof insertCustomQuestionSchema>;

export type StandardQuestion = typeof standardQuestions.$inferSelect;
export type InsertStandardQuestion = z.infer<typeof insertStandardQuestionSchema>;

// Asset Manager Module - for storing uploaded files and their metadata
export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(), // Original filename
  description: text("description"), // Optional description
  fileType: text("file_type"), // MIME type
  fileSize: integer("file_size"), // Size in bytes
  url: text("url").notNull(), // Path to the file on disk or URL
  tags: jsonb("tags"), // JSON array of tags for categorization
  uploadedBy: integer("uploaded_by").notNull(), // User who uploaded the file
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastAccessedAt: timestamp("last_accessed_at"), // When the file was last accessed
});

export const assetsRelations = relations(assets, ({ one }) => ({
  uploader: one(users, {
    fields: [assets.uploadedBy],
    references: [users.id],
  }),
}));

export const insertAssetSchema = createInsertSchema(assets).omit({
  id: true,
  createdAt: true,
});

export type Asset = typeof assets.$inferSelect;
export type InsertAsset = z.infer<typeof insertAssetSchema>;

// Asset Category Enum
export const AssetCategory = {
  EQUIPMENT: "EQUIPMENT",
  VEHICLE: "VEHICLE",
  ELECTRONICS: "ELECTRONICS",
  FURNITURE: "FURNITURE",
  TOOLS: "TOOLS",
  SAFETY: "SAFETY",
  OTHER: "OTHER",
} as const;

export type AssetCategory = (typeof AssetCategory)[keyof typeof AssetCategory];

// Asset Status Enum
export const AssetStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  MAINTENANCE: "MAINTENANCE",
  RETIRED: "RETIRED",
  LOST: "LOST",
} as const;

export type AssetStatus = (typeof AssetStatus)[keyof typeof AssetStatus];

// Asset Location Enum
export const AssetLocation = {
  WAREHOUSE: "WAREHOUSE",
  OFFICE: "OFFICE",
  FIELD: "FIELD",
  DOCK: "DOCK",
  STORAGE: "STORAGE",
  CLIENT_SITE: "CLIENT_SITE",
  OTHER: "OTHER",
} as const;

export type AssetLocation = (typeof AssetLocation)[keyof typeof AssetLocation];

// Company Assets for Asset Manager Module - for tracking physical company assets
export const companyAssets = pgTable("company_assets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  manufacturer: text("manufacturer").notNull(),
  owner: text("owner").notNull(),  // Person responsible
  department: text("department"),   // Department or business unit
  category: text("category").notNull().$type<AssetCategory>(),
  barcode: text("barcode"),
  serialNumber: text("serial_number"),
  description: text("description"),
  
  // Financial information
  purchasePrice: text("purchase_price"),  // Stored as string to allow different currencies
  currency: text("currency").default("USD"),
  purchaseDate: date("purchase_date"),
  // Renamed to implementationDate below
  warrantyExpiration: date("warranty_expiration"),
  depreciation: text("depreciation"),     // Depreciation schedule or amount
  assetValue: text("asset_value"),        // Current book value
  
  // Location and status
  location: text("location").$type<AssetLocation>().default(AssetLocation.WAREHOUSE),
  status: text("status").$type<AssetStatus>().default(AssetStatus.ACTIVE),
  
  // Template and tags
  template: text("template"),  // For standardized assets that follow a template
  tags: jsonb("tags"),  // Array of tags for searching/filtering
  
  // Additional metadata
  model: text("model"),
  assetCondition: text("condition"),
  notes: text("notes"),
  manufacturerPartNumber: text("manufacturer_part_number"),
  supplierName: text("supplier_name"),
  poNumber: text("po_number"),         // Purchase order reference
  vendorInformation: text("vendor_information"),
  
  // Media
  photoUrl: text("photo_url"),
  compressedImage: text("compressed_image"), // Base64 encoded compressed image
  imageMetadata: jsonb("image_metadata"), // Compression metadata
  documentUrls: jsonb("document_urls"),  // Array of document URLs (manuals, receipts, etc.)
  
  // Maintenance and tracking
  lastMaintenanceDate: date("last_maintenance_date"),
  nextMaintenanceDate: date("next_maintenance_date"),
  maintenanceSchedule: text("maintenance_schedule"), // Description of maintenance requirements
  maintenanceContact: text("maintenance_contact"),
  maintenanceNotes: text("maintenance_notes"),
  implementationDate: date("implementation_date"), // When the asset was deployed
  expectedLifetime: text("expected_lifetime"), // Expected operational lifespan
  certificationDate: date("certification_date"),
  certificationExpiry: date("certification_expiry"),
  
  // Multi-tenant isolation
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: integer("created_by"),
  updatedBy: integer("updated_by"),
});

export const companyAssetsRelations = relations(companyAssets, ({ one }) => ({
  photo: one(assets, {
    fields: [companyAssets.photoUrl],
    references: [assets.url],
  }),
}));

export const insertCompanyAssetSchema = createInsertSchema(companyAssets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCompanyAssetSchema = createInsertSchema(companyAssets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export type CompanyAsset = typeof companyAssets.$inferSelect;
export type InsertCompanyAsset = z.infer<typeof insertCompanyAssetSchema>;
export type UpdateCompanyAsset = z.infer<typeof updateCompanyAssetSchema>;

// File Storage Table - for blob storage management
export const fileStorage = pgTable("file_storage", {
  id: text("id").primaryKey(), // UUID for file identification
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(), // File size in bytes
  path: text("path").notNull(), // Physical file path
  url: text("url").notNull(), // Public URL for access
  folder: text("folder").default("general"), // Organization folder (images, documents, etc.)
  tenantId: integer("tenant_id"), // For multi-tenant isolation
  uploadedBy: integer("uploaded_by"), // User who uploaded the file
  isTemporary: boolean("is_temporary").default(false), // For cleanup of temp files
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const fileStorageRelations = relations(fileStorage, ({ one }) => ({
  tenant: one(tenants, {
    fields: [fileStorage.tenantId],
    references: [tenants.id],
  }),
  uploader: one(users, {
    fields: [fileStorage.uploadedBy],
    references: [users.id],
  }),
}));

export const insertFileStorageSchema = createInsertSchema(fileStorage).omit({
  createdAt: true,
  updatedAt: true,
});

export type FileStorage = typeof fileStorage.$inferSelect;
export type InsertFileStorage = z.infer<typeof insertFileStorageSchema>;

// Organization Default Hours Table
export const organizationDefaultHours = pgTable("organization_default_hours", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  dayOfWeek: integer("day_of_week").notNull(), // 0 = Sunday, 1 = Monday, etc.
  isOpen: boolean("is_open").default(false).notNull(),
  openTime: text("open_time").default("09:00"),
  closeTime: text("close_time").default("17:00"),
  breakStart: text("break_start"),
  breakEnd: text("break_end"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueTenantDay: unique().on(table.tenantId, table.dayOfWeek),
}));

export const organizationDefaultHoursRelations = relations(organizationDefaultHours, ({ one }) => ({
  tenant: one(tenants, {
    fields: [organizationDefaultHours.tenantId],
    references: [tenants.id],
  }),
}));

// Organization Holidays Table
export const organizationHolidays = pgTable("organization_holidays", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  name: text("name").notNull(),
  date: date("date").notNull(),
  isRecurring: boolean("is_recurring").default(false).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueTenantDate: unique().on(table.tenantId, table.date),
}));

export const organizationHolidaysRelations = relations(organizationHolidays, ({ one }) => ({
  tenant: one(tenants, {
    fields: [organizationHolidays.tenantId],
    references: [tenants.id],
  }),
}));

export const insertOrganizationDefaultHoursSchema = createInsertSchema(organizationDefaultHours).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrganizationHolidaySchema = createInsertSchema(organizationHolidays).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type OrganizationDefaultHours = typeof organizationDefaultHours.$inferSelect;
export type InsertOrganizationDefaultHours = z.infer<typeof insertOrganizationDefaultHoursSchema>;
export type OrganizationHoliday = typeof organizationHolidays.$inferSelect;
export type InsertOrganizationHoliday = z.infer<typeof insertOrganizationHolidaySchema>;

// Default hours type for organization settings
export type DefaultHours = {
  id: number;
  dayOfWeek: number;
  dayName: string;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
  breakStart?: string;
  breakEnd?: string;
};

export type DayHours = {
  open: boolean;
  start: string;
  end: string;
  breakStart?: string;
  breakEnd?: string;
};

// Organization Settings Interface for type safety
export interface OrganizationSettings {
  confirmationCodePrefix?: string;
  defaultHours?: DefaultHours[];
  holidays?: OrganizationHoliday[];
  emailNotifications?: boolean;
  timezone?: string;
  logo?: string;
  // Email template customization
  emailTemplates?: {
    confirmation?: {
      subject?: string;
      headerText?: string;
      footerText?: string;
      includeQrCode?: boolean;
      includeCalendarAttachment?: boolean;
    };
    reminder?: {
      subject?: string;
      headerText?: string;
      footerText?: string;
      hoursBeforeReminder?: number;
    };
    reschedule?: {
      subject?: string;
      headerText?: string;
      footerText?: string;
    };
    cancellation?: {
      subject?: string;
      headerText?: string;
      footerText?: string;
    };
    checkout?: {
      subject?: string;
      headerText?: string;
      footerText?: string;
      includeReleaseNotes?: boolean;
      includeReleaseImages?: boolean;
    };
  };
}

// Multi-tenant support - Tenants table
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
  settings: jsonb("settings").default({}), // Contains defaultHours for facilities
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: integer("created_by"),
  updatedBy: integer("updated_by"),
});

// Feature flags for tenants - which modules are enabled
export const featureFlags = pgTable("feature_flags", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  module: text("module").$type<AvailableModule>().notNull(),
  enabled: boolean("enabled").default(false),
  settings: jsonb("settings").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: integer("created_by"),
  updatedBy: integer("updated_by"),
}, (table) => {
  return {
    tenantModuleUnique: unique().on(table.tenantId, table.module),
  };
});

// Organization-Users join table
export const organizationUsers = pgTable("organization_users", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  roleId: integer("role_id").notNull().references(() => roles.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    orgUserUnique: unique().on(table.organizationId, table.userId),
  };
});

export const insertOrgUserSchema = createInsertSchema(organizationUsers).omit({
  id: true,
  createdAt: true,
});

export type OrganizationUser = typeof organizationUsers.$inferSelect;
export type InsertOrganizationUser = z.infer<typeof insertOrgUserSchema>;

// Organization-Modules join table
export const organizationModules = pgTable("organization_modules", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  moduleName: text("module_name").notNull().$type<AvailableModule>(),
  enabled: boolean("enabled").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    orgModuleUnique: unique().on(table.organizationId, table.moduleName),
  };
});

export const insertOrgModuleSchema = createInsertSchema(organizationModules).omit({
  id: true,
  createdAt: true,
});

export type OrganizationModule = typeof organizationModules.$inferSelect;
export type InsertOrganizationModule = z.infer<typeof insertOrgModuleSchema>;

// Activity Logs for tracking organization changes
export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull(),
  action: text("action").notNull(), // e.g., 'module_enabled', 'user_added', etc.
  details: text("details").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  timestamp: true,
});

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userPreferences.userId],
    references: [users.id],
  }),
  organization: one(tenants, {
    fields: [userPreferences.organizationId],
    references: [tenants.id],
  }),
}));


// Tenant relations
export const tenantsRelations = relations(tenants, ({ many }) => ({
  featureFlags: many(featureFlags),
  users: many(users),
  organizationUsers: many(organizationUsers),
  organizationModules: many(organizationModules),
  activityLogs: many(activityLogs),
  userPreferences: many(userPreferences),
}));

// Feature flags relations
export const featureFlagsRelations = relations(featureFlags, ({ one }) => ({
  tenant: one(tenants, {
    fields: [featureFlags.tenantId],
    references: [tenants.id],
  }),
}));

// Create insert schemas
export const insertTenantSchema = createInsertSchema(tenants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFeatureFlagSchema = createInsertSchema(featureFlags).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Export types
export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;

export type FeatureFlag = typeof featureFlags.$inferSelect;
export type InsertFeatureFlag = z.infer<typeof insertFeatureFlagSchema>;

// Now define the relations that were postponed due to circular references
export const organizationUsersRelations = relations(organizationUsers, ({ one }) => ({
  organization: one(tenants, {
    fields: [organizationUsers.organizationId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [organizationUsers.userId],
    references: [users.id],
  }),
  role: one(roles, {
    fields: [organizationUsers.roleId],
    references: [roles.id],
  }),
}));

export const organizationModulesRelations = relations(organizationModules, ({ one }) => ({
  organization: one(tenants, {
    fields: [organizationModules.organizationId],
    references: [tenants.id],
  }),
}));

// Organization Facilities mapping
export const organizationFacilities = pgTable("organization_facilities", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  facilityId: integer("facility_id").notNull().references(() => facilities.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    orgFacilityUnique: unique().on(table.organizationId, table.facilityId),
  };
});

export const insertOrgFacilitySchema = createInsertSchema(organizationFacilities).omit({
  id: true,
  createdAt: true,
});

export type OrganizationFacility = typeof organizationFacilities.$inferSelect;
export type InsertOrganizationFacility = z.infer<typeof insertOrgFacilitySchema>;

// Organization Facilities Relations
export const organizationFacilitiesRelations = relations(organizationFacilities, ({ one }) => ({
  organization: one(tenants, {
    fields: [organizationFacilities.organizationId],
    references: [tenants.id],
  }),
  facility: one(facilities, {
    fields: [organizationFacilities.facilityId],
    references: [facilities.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  organization: one(tenants, {
    fields: [activityLogs.organizationId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));

// OCR Jobs table - for queuing BOL documents for OCR processing
export const ocrJobs = pgTable("ocr_jobs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  s3Key: text("s3_key").notNull(),
  status: text("status").notNull().default("queued"), // queued, processing, completed, failed
  result: jsonb("result"), // OCR processing results
  createdAt: timestamp("created_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
  retryCount: integer("retry_count").default(0),
  errorMessage: text("error_message"),
});

export const insertOcrJobSchema = createInsertSchema(ocrJobs).omit({
  id: true,
  createdAt: true,
});

export type OcrJob = typeof ocrJobs.$inferSelect;
export type InsertOcrJob = z.infer<typeof insertOcrJobSchema>;

// Password Reset Tokens Model
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  usedAt: timestamp("used_at"),
});

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
  id: true,
  createdAt: true,
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;