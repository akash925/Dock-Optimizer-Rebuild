import { integer, pgTable, serial, text, varchar, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

/**
 * Schema for bill of lading documents processed via OCR
 */
export const bolDocuments = pgTable('bol_documents', {
  id: serial('id').primaryKey(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  originalFileName: varchar('original_file_name', { length: 255 }).notNull(),
  filePath: varchar('file_path', { length: 255 }).notNull(),
  fileSize: integer('file_size').notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  tenantId: integer('tenant_id'),
  uploadedBy: integer('uploaded_by'),
  ocrData: jsonb('ocr_data'),  // Raw OCR output
  parsedData: jsonb('parsed_data'), // Structured extracted fields
  ocrStatus: varchar('ocr_status', { length: 50 }).default('completed').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Define the insert schema with Zod
export const insertBolDocumentSchema = createInsertSchema(bolDocuments, {
  // Define custom validations for specific fields if needed
  fileSize: z.number().positive(),
  mimeType: z.string().min(1),
}).omit({ id: true, createdAt: true, updatedAt: true });

// Create types from the schema
export type BolDocument = typeof bolDocuments.$inferSelect;
export type InsertBolDocument = z.infer<typeof insertBolDocumentSchema>;