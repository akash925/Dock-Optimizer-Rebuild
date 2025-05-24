import { pgTable, serial, integer, timestamp, varchar, decimal } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { bolDocuments } from './bol';

/**
 * Schema for OCR analytics data
 * This table tracks performance metrics for the OCR process
 */
export const ocrAnalytics = pgTable('ocr_analytics', {
  id: serial('id').primaryKey(),
  bolDocumentId: integer('bol_document_id').notNull().references(() => bolDocuments.id, { onDelete: 'cascade' }),
  tenantId: integer('tenant_id'),
  processingTime: decimal('processing_time', { precision: 10, scale: 3 }), // Processing time in seconds
  confidenceScore: decimal('confidence_score', { precision: 5, scale: 2 }), // Overall confidence score (0-100)
  engineVersion: varchar('engine_version', { length: 50 }), // Version of the OCR engine used
  documentType: varchar('document_type', { length: 50 }).default('BOL'), // Type of document processed
  status: varchar('status', { length: 50 }).default('success'), // success, partial, failed
  createdAt: timestamp('created_at').defaultNow(),
});

// Define the insert schema with Zod
export const insertOcrAnalyticsSchema = createInsertSchema(ocrAnalytics, {
  // Custom validations
  processingTime: z.coerce.number().min(0).optional(),
  confidenceScore: z.coerce.number().min(0).max(100).optional(),
}).omit({
  id: true,
  createdAt: true,
});

// Create types from the schema
export type OcrAnalytics = typeof ocrAnalytics.$inferSelect;
export type InsertOcrAnalytics = z.infer<typeof insertOcrAnalyticsSchema>;