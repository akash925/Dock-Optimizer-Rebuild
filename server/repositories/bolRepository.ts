import { db } from '../db';
import { bolDocuments, BolDocument, InsertBolDocument } from '../../drizzle/schema/bol';
import { appointmentBolLinks, InsertAppointmentBolLink } from '../../drizzle/schema/appointment_bol_links';
import { ocrAnalytics, InsertOcrAnalytics } from '../../drizzle/schema/ocr_analytics';
import { eq } from 'drizzle-orm';

/**
 * Repository for BOL document management
 * Handles database operations for BOL documents and related entities
 */
export class BolRepository {
  /**
   * Create a new BOL document entry in the database
   * @param document BOL document data to insert
   * @returns The created BOL document with ID
   */
  async createBolDocument(document: InsertBolDocument): Promise<BolDocument> {
    const [newDocument] = await db.insert(bolDocuments)
      .values(document)
      .returning();
    
    return newDocument;
  }

  /**
   * Associate a BOL document with an appointment/schedule
   * @param appointmentId The appointment/schedule ID
   * @param bolDocumentId The BOL document ID
   * @returns The created link record
   */
  async linkBolToAppointment(appointmentId: number, bolDocumentId: number) {
    const linkData: InsertAppointmentBolLink = {
      appointmentId,
      bolDocumentId,
    };

    const [link] = await db.insert(appointmentBolLinks)
      .values(linkData)
      .returning();
    
    return link;
  }

  /**
   * Record OCR analytics data
   * @param analytics OCR analytics data to record
   * @returns The created analytics record
   */
  async recordOcrAnalytics(analytics: InsertOcrAnalytics) {
    const [record] = await db.insert(ocrAnalytics)
      .values([analytics])
      .returning();
    
    return record;
  }

  /**
   * Get a BOL document by its ID
   * @param id BOL document ID
   * @returns BOL document or undefined if not found
   */
  async getBolDocument(id: number): Promise<BolDocument | undefined> {
    const [document] = await db.select()
      .from(bolDocuments)
      .where(eq(bolDocuments.id, id));
    
    return document;
  }

  /**
   * Get all BOL documents for a specific appointment/schedule
   * @param appointmentId The appointment/schedule ID
   * @returns Array of BOL documents linked to the appointment
   */
  async getBolDocumentsForAppointment(appointmentId: number): Promise<BolDocument[]> {
    const result = await db.select({
      bolDocument: bolDocuments,
    })
    .from(appointmentBolLinks)
    .leftJoin(bolDocuments, eq(appointmentBolLinks.bolDocumentId, bolDocuments.id))
    .where(eq(appointmentBolLinks.appointmentId, appointmentId));
    
    return result.map(r => r.bolDocument).filter(Boolean);
  }

  /**
   * Update the status of a BOL document
   * @param id BOL document ID
   * @param status New processing status
   * @returns Updated BOL document
   */
  async updateBolDocumentStatus(id: number, status: string): Promise<BolDocument | null> {
    const [updated] = await db.update(bolDocuments)
      .set({ processingStatus: status, updatedAt: new Date() })
      .where(eq(bolDocuments.id, id))
      .returning();
    
    return updated || null;
  }
}