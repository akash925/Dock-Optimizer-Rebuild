/**
 * BOL (Bill of Lading) Tables Schema
 * 
 * Defines database tables for BOL document storage, OCR analytics,
 * and linking BOLs to appointments.
 */

import { pgTable, text, integer, timestamp, serial, json } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

/**
 * BOL Documents Table
 * Stores uploaded BOL document files and their metadata
 */
export const bolDocuments = pgTable('bol_documents', {
  id: serial('id').primaryKey(),
  fileName: text('file_name').notNull(),
  originalFileName: text('original_file_name').notNull(),
  filePath: text('file_path').notNull(),
  fileSize: integer('file_size').notNull(),
  mimeType: text('mime_type').notNull(),
  tenantId: integer('tenant_id'),
  uploadedBy: integer('uploaded_by'),
  ocrData: json('ocr_data'),
  parsedData: json('parsed_data'),
  ocrStatus: text('ocr_status').default('pending'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at')
});

/**
 * OCR Analytics Table
 * Tracks performance metrics for OCR processing
 */
export const ocrAnalytics = pgTable('ocr_analytics', {
  id: serial('id').primaryKey(),
  bolDocumentId: integer('bol_document_id').notNull(),
  tenantId: integer('tenant_id'),
  createdAt: timestamp('created_at').defaultNow(),
  processingTime: text('processing_time'), // in seconds
  confidenceScore: text('confidence_score'), // 0-100
  engineVersion: text('engine_version'),
  documentType: text('document_type')
});

/**
 * Appointment BOL Links Table
 * Links BOL documents to appointments (many-to-many relationship)
 */
export const appointmentBolLinks = pgTable('appointment_bol_links', {
  id: serial('id').primaryKey(),
  bolDocumentId: integer('bol_document_id').notNull(),
  scheduleId: integer('schedule_id').notNull(),
  createdAt: timestamp('created_at').defaultNow()
});

// Define Zod schemas for data validation
export const insertBolDocumentSchema = createInsertSchema(bolDocuments, {
  // Additional validation rules
  fileSize: z.number().positive(),
  mimeType: z.string().min(1),
  fileName: z.string().min(1),
  originalFileName: z.string().min(1),
  filePath: z.string().min(1)
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertOcrAnalyticsSchema = createInsertSchema(ocrAnalytics, {
  processingTime: z.string().optional(),
  confidenceScore: z.string().optional()
}).omit({
  id: true, 
  createdAt: true
});

export const insertAppointmentBolLinkSchema = createInsertSchema(appointmentBolLinks).omit({
  id: true,
  createdAt: true
});