/**
 * BOL (Bill of Lading) Repository
 * 
 * Handles database operations for BOL documents, links, and analytics
 */

import { db } from '../db.js';
import { eq, and } from 'drizzle-orm';
import { 
  bolDocuments, 
  ocrAnalytics, 
  appointmentBolLinks 
} from '../../drizzle/schema/bol.js';
import logger from '../logger.js';

export class BolRepository {
  /**
   * Create a new BOL document record
   * 
   * @param {Object} documentData - BOL document data
   * @returns {Promise<Object>} - Created document
   */
  async createBolDocument(documentData) {
    try {
      const [document] = await db
        .insert(bolDocuments)
        .values(documentData)
        .returning();
      
      return document;
    } catch (error) {
      logger.error('BOL-Repository', 'Error creating BOL document', error);
      throw error;
    }
  }
  
  /**
   * Create OCR analytics record
   * 
   * @param {Object} analyticsData - OCR analytics data
   * @returns {Promise<Object>} - Created analytics record
   */
  async createOcrAnalytics(analyticsData) {
    try {
      // Convert numeric values to strings for storage if they're not already
      const processedData = {
        ...analyticsData,
        processingTime: String(analyticsData.processingTime || "0"),
        confidenceScore: String(analyticsData.confidenceScore || "0")
      };
      
      const [analytics] = await db
        .insert(ocrAnalytics)
        .values(processedData)
        .returning();
      
      return analytics;
    } catch (error) {
      logger.error('BOL-Repository', 'Error creating OCR analytics', error);
      throw error;
    }
  }
  
  /**
   * Create a link between a BOL document and an appointment
   * 
   * @param {Object} linkData - Link data with bolDocumentId and scheduleId
   * @returns {Promise<Object>} - Created link
   */
  async createBolAppointmentLink(linkData) {
    try {
      // 🔥 FIX: Handle potential column name variations for database compatibility
      const linkPayload = {
        bolDocumentId: linkData.bolDocumentId,
        scheduleId: linkData.scheduleId || linkData.schedule_id, // Handle both snake_case and camelCase
        createdAt: new Date()
      };

      console.log('[BOL-Repository] Creating link with payload:', linkPayload);

      const [link] = await db
        .insert(appointmentBolLinks)
        .values(linkPayload)
        .returning();
      
      console.log('[BOL-Repository] Successfully created link:', link);
      return link;
    } catch (error) {
      logger.error('BOL-Repository', 'Error creating BOL-appointment link', error);
      
      // 🔥 ENHANCED: If column error, try alternative column name
      if (error.message && error.message.includes('schedule_id')) {
        logger.warn('BOL-Repository', 'Attempting with alternative column structure');
        try {
          // Use raw SQL as fallback if schema mismatch
          const rawQuery = `
            INSERT INTO appointment_bol_links (bol_document_id, appointment_id, created_at)
            VALUES ($1, $2, $3)
            RETURNING *
          `;
          const result = await db.execute(rawQuery, [
            linkData.bolDocumentId,
            linkData.scheduleId,
            new Date()
          ]);
          return result.rows[0];
        } catch (fallbackError) {
          logger.error('BOL-Repository', 'Fallback query also failed', fallbackError);
        }
      }
      throw error;
    }
  }
  
  /**
   * Get a BOL document by ID
   * 
   * @param {number} id - Document ID
   * @returns {Promise<Object|null>} - BOL document or null if not found
   */
  async getBolDocument(id) {
    try {
      const [document] = await db
        .select()
        .from(bolDocuments)
        .where(eq(bolDocuments.id, id));
      
      return document || null;
    } catch (error) {
      logger.error('BOL-Repository', 'Error getting BOL document', error);
      throw error;
    }
  }
  
  /**
   * Get all BOL documents linked to a specific appointment
   * 
   * @param {number} scheduleId - ID of the appointment/schedule
   * @returns {Promise<Array>} - Array of BOL documents
   */
  async getBolDocumentsForSchedule(scheduleId) {
    try {
      console.log('[BOL-Repository] Fetching BOL documents for schedule:', scheduleId);
      
      // 🔥 FIX: Try primary column name first, then fallback
      let links;
      try {
        links = await db
          .select()
          .from(appointmentBolLinks)
          .where(eq(appointmentBolLinks.scheduleId, scheduleId));
      } catch (primaryError) {
        if (primaryError.message && primaryError.message.includes('schedule_id')) {
          logger.warn('BOL-Repository', 'Primary column failed, trying fallback query');
          // Use raw SQL as fallback
          const rawQuery = `
            SELECT * FROM appointment_bol_links 
            WHERE appointment_id = $1
          `;
          const result = await db.execute(rawQuery, [scheduleId]);
          links = result.rows;
        } else {
          throw primaryError;
        }
      }
      
      if (!links || links.length === 0) {
        console.log('[BOL-Repository] No BOL links found for schedule:', scheduleId);
        return [];
      }
      
      console.log('[BOL-Repository] Found', links.length, 'BOL links for schedule:', scheduleId);
      
      // Get all document IDs from the links
      const documentIds = links.map(link => link.bolDocumentId || link.bol_document_id);
      
      // Then get the documents
      const documents = await Promise.all(
        documentIds.map(id => this.getBolDocument(id))
      );
      
      // Filter out any null values (documents that weren't found)
      const validDocuments = documents.filter(doc => doc !== null);
      console.log('[BOL-Repository] Retrieved', validDocuments.length, 'valid BOL documents');
      return validDocuments;
    } catch (error) {
      logger.error('BOL-Repository', 'Error getting BOL documents for schedule', error);
      throw error;
    }
  }
  
  /**
   * Update a BOL document
   * 
   * @param {number} id - Document ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object|null>} - Updated document or null if not found
   */
  async updateBolDocument(id, updateData) {
    try {
      const [updatedDocument] = await db
        .update(bolDocuments)
        .set({
          ...updateData,
          updatedAt: new Date()
        })
        .where(eq(bolDocuments.id, id))
        .returning();
      
      return updatedDocument || null;
    } catch (error) {
      logger.error('BOL-Repository', 'Error updating BOL document', error);
      throw error;
    }
  }
  
  /**
   * Delete a BOL document by ID
   * 
   * @param {number} id - Document ID
   * @returns {Promise<boolean>} - True if deleted, false if not found
   */
  async deleteBolDocument(id) {
    try {
      // First delete any links to appointments
      await db
        .delete(appointmentBolLinks)
        .where(eq(appointmentBolLinks.bolDocumentId, id));
      
      // Then delete any analytics records
      await db
        .delete(ocrAnalytics)
        .where(eq(ocrAnalytics.bolDocumentId, id));
      
      // Finally delete the document itself
      const result = await db
        .delete(bolDocuments)
        .where(eq(bolDocuments.id, id))
        .returning({ id: bolDocuments.id });
      
      return result.length > 0;
    } catch (error) {
      logger.error('BOL-Repository', 'Error deleting BOL document', error);
      throw error;
    }
  }
  
  /**
   * Get OCR analytics by document ID
   * 
   * @param {number} documentId - BOL document ID
   * @returns {Promise<Array>} - Array of analytics records
   */
  async getOcrAnalyticsByDocument(documentId) {
    try {
      const analytics = await db
        .select()
        .from(ocrAnalytics)
        .where(eq(ocrAnalytics.bolDocumentId, documentId));
      
      return analytics;
    } catch (error) {
      logger.error('BOL-Repository', 'Error getting OCR analytics', error);
      throw error;
    }
  }
}