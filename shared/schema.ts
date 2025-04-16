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

// Dock Model
export const docks = pgTable("docks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  type: text("type").notNull(), // e.g., loading, unloading, both
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
  truckNumber: text("truck_number").notNull(),
  trailerNumber: text("trailer_number"),
  driverName: text("driver_name"),
  driverPhone: text("driver_phone"),
  bolNumber: text("bol_number"),
  poNumber: text("po_number"),
  palletCount: text("pallet_count"),
  weight: text("weight"),
  appointmentMode: text("appointment_mode").default("trailer"), // trailer or container
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  type: text("type").notNull(), // inbound or outbound
  status: text("status").notNull(), // scheduled, in-progress, completed, cancelled
  notes: text("notes"),
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

// Define relations
export const usersRelations = relations(users, ({ many }) => ({
  createdSchedules: many(schedules, { relationName: "user_created_schedules" }),
  modifiedSchedules: many(schedules, { relationName: "user_modified_schedules" }),
  notifications: many(notifications),
}));

export const docksRelations = relations(docks, ({ many, one }) => ({
  schedules: many(schedules),
  facility: one(facilities, {
    fields: [docks.id], // This should actually be a facility_id field that we need to add
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
}));

export const holidaysRelations = relations(holidays, ({ one }) => ({
  facility: one(facilities, {
    fields: [holidays.facilityId],
    references: [facilities.id],
    relationName: "facility_holidays"
  }),
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