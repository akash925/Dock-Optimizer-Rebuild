import { pgTable, text, serial, integer, boolean, timestamp, jsonb, date } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User Roles
export type Role = "admin" | "manager" | "worker";

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
  dockId: integer("dock_id").notNull(),
  carrierId: integer("carrier_id").notNull(),
  appointmentTypeId: integer("appointment_type_id"),
  truckNumber: text("truck_number").notNull(),
  trailerNumber: text("trailer_number"),
  driverName: text("driver_name"),
  driverPhone: text("driver_phone"),
  bolNumber: text("bol_number"), // Free text field for BOL (can contain text and numbers)
  poNumber: text("po_number"),
  palletCount: text("pallet_count"),
  weight: text("weight"),
  appointmentMode: text("appointment_mode").default("trailer"), // trailer or container
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  type: text("type").notNull(), // inbound or outbound
  status: text("status").notNull(), // scheduled, in-progress, completed, cancelled
  notes: text("notes"),
  customFormData: jsonb("custom_form_data"), // Stores responses to custom questions
  createdBy: integer("created_by").notNull(), // User ID who created the schedule
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastModifiedAt: timestamp("last_modified_at"),
  lastModifiedBy: integer("last_modified_by"),
});

export const insertScheduleSchema = createInsertSchema(schedules).omit({
  id: true,
  createdAt: true,
  lastModifiedAt: true,
});

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
  timeInterval: integer("time_interval").notNull().default(TimeInterval.MINUTES_30),
  maxConcurrentInbound: integer("max_concurrent_inbound").notNull().default(2),
  maxConcurrentOutbound: integer("max_concurrent_outbound").notNull().default(2),
  shareAvailabilityInfo: boolean("share_availability_info").notNull().default(true),
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
  gracePeriod: integer("grace_period").notNull().default(15), // in minutes
  emailReminderTime: integer("email_reminder_time").notNull().default(24), // in hours
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
  order: integer("order").notNull(),
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
export const usersRelations = relations(users, ({ many }) => ({
  createdSchedules: many(schedules, { relationName: "user_created_schedules" }),
  modifiedSchedules: many(schedules, { relationName: "user_modified_schedules" }),
  notifications: many(notifications),
}));

export const docksRelations = relations(docks, ({ many, one }) => ({
  schedules: many(schedules),
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
  dailyAvailability: many(dailyAvailability),
  customQuestions: many(customQuestions),
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

export type CustomQuestion = typeof customQuestions.$inferSelect;
export type InsertCustomQuestion = z.infer<typeof insertCustomQuestionSchema>;