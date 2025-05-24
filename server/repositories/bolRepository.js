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
      const [link] = await db
        .insert(appointmentBolLinks)
        .values(linkData)
        .returning();
      
      return link;
    } catch (error) {
      logger.error('BOL-Repository', 'Error creating BOL-appointment link', error);
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
      // First get the links
      const links = await db
        .select()
        .from(appointmentBolLinks)
        .where(eq(appointmentBolLinks.scheduleId, scheduleId));
      
      if (!links || links.length === 0) {
        return [];
      }
      
      // Get all document IDs from the links
      const documentIds = links.map(link => link.bolDocumentId);
      
      // Then get the documents
      const documents = await Promise.all(
        documentIds.map(id => this.getBolDocument(id))
      );
      
      // Filter out any null values (documents that weren't found)
      return documents.filter(doc => doc !== null);
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