import { pgTable, serial, integer, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { bolDocuments } from './bol.ts';
import { schedules } from '../../shared/schema.ts';

/**
 * Schema for linking BOL documents to appointments/schedules
 * This allows multiple BOL documents to be associated with an appointment
 * and vice versa (many-to-many relationship)
 */
export const appointmentBolLinks = pgTable('appointment_bol_links', {
  id: serial('id').primaryKey(),
  appointmentId: integer('appointment_id').notNull().references(() => schedules.id, { onDelete: 'cascade' }),
  bolDocumentId: integer('bol_document_id').notNull().references(() => bolDocuments.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow(),
});

// Define the insert schema with Zod
export const insertAppointmentBolLinkSchema = createInsertSchema(appointmentBolLinks).omit({
  id: true,
  createdAt: true,
});

// Create types from the schema
export type AppointmentBolLink = typeof appointmentBolLinks.$inferSelect;
export type InsertAppointmentBolLink = z.infer<typeof insertAppointmentBolLinkSchema>;