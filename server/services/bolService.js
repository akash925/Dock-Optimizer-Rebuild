/**
 * BOL (Bill of Lading) Service
 * 
 * Handles processing, storage, and retrieval of BOL documents
 * with OCR capabilities and database integration.
 */

import { processImageFile } from '../ocr/ocr_connector.mjs';
import { validateOcrResult, extractFieldsFromOcrResults } from '../utils/ocrValidator.mjs';
import { BolRepository } from '../repositories/bolRepository.js';
import logger from '../logger.js';

export class BolService {
  constructor() {
    this.repository = new BolRepository();
    this.OCR_TIMEOUT = 30000; // 30 seconds timeout for OCR processing
  }

  /**
   * Process an image file with OCR, with timeout handling
   * 
   * @param {string} filePath - Path to the image file
   * @returns {Promise<Object>} - OCR processing results
   */
  async processImageWithTimeout(filePath) {
    logger.info('BOL-Service', `Processing image with timeout: ${filePath}`);
    
    // Create a promise that will resolve with the OCR result
    const ocrPromise = processImageFile(filePath);
    
    // Create a promise that will reject after the timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('OCR processing timed out')), this.OCR_TIMEOUT);
    });
    
    try {
      // Race the OCR processing against the timeout
      const result = await Promise.race([ocrPromise, timeoutPromise]);
      
      // Validate the OCR result
      const isValid = validateOcrResult(result);
      
      if (!isValid) {
        logger.warn('BOL-Service', 'OCR result validation failed - insufficient text detected', {
          filePath
        });
        
        // Even though validation failed, we'll return the result
        // so the caller can decide what to do
        return {
          ...result,
          validation: {
            success: false,
            message: 'OCR result validation failed - insufficient text detected'
          }
        };
      }
      
      // Extract structured fields from OCR results
      const extractedFields = extractFieldsFromOcrResults(result);
      
      // Add extracted fields to the result
      return {
        ...result,
        validation: {
          success: true,
          message: 'OCR result validation passed'
        },
        metadata: extractedFields
      };
    } catch (error) {
      logger.error('BOL-Service', 'Error processing image with OCR', error, {
        filePath,
        errorType: error.name,
        errorMessage: error.message
      });
      
      // Rethrow the error to be handled by the caller
      throw error;
    }
  }
  
  /**
   * Save a BOL document to the database
   * 
   * @param {Object} fileInfo - Information about the uploaded file
   * @param {Object} ocrResult - OCR processing results
   * @param {number} tenantId - ID of the tenant
   * @param {number} userId - ID of the user who uploaded the document
   * @param {string} status - Processing status ('completed', 'failed', 'pending')
   * @returns {Promise<Object>} - Saved document
   */
  async saveBolDocument(fileInfo, ocrResult, tenantId, userId, status = 'completed') {
    try {
      logger.info('BOL-Service', 'Saving BOL document to database', {
        fileName: fileInfo.originalName,
        fileSize: fileInfo.size,
        status
      });
      
      // Prepare document data for storage
      const documentData = {
        fileName: fileInfo.name,
        originalFileName: fileInfo.originalName,
        filePath: fileInfo.path,
        fileSize: fileInfo.size,
        mimeType: fileInfo.mimetype,
        tenantId: tenantId || null,
        uploadedBy: userId || null,
        ocrData: ocrResult ? JSON.stringify(ocrResult) : null,
        parsedData: ocrResult?.metadata ? JSON.stringify(ocrResult.metadata) : null,
        ocrStatus: status
      };
      
      // Save to database
      const savedDocument = await this.repository.createBolDocument(documentData);
      
      // Save OCR analytics for monitoring and improvement
      if (ocrResult) {
        const processingTime = ocrResult.processingTime || 0;
        const confidence = ocrResult.averageConfidence || 0;
        
        await this.saveOcrAnalytics({
          bolDocumentId: savedDocument.id,
          processingTime: String(processingTime),  // Convert to string for DB storage
          confidenceScore: String(confidence),     // Convert to string for DB storage
          engineVersion: ocrResult.engineVersion || 'PaddleOCR',
          documentType: 'BOL'
        });
      }
      
      return savedDocument;
    } catch (error) {
      logger.error('BOL-Service', 'Error saving BOL document to database', error, {
        fileName: fileInfo.originalName
      });
      throw error;
    }
  }
  
  /**
   * Save OCR analytics to the database
   * 
   * @param {Object} analyticsData - OCR analytics data
   * @returns {Promise<Object>} - Saved analytics
   */
  async saveOcrAnalytics(analyticsData) {
    try {
      logger.debug('BOL-Service', 'Saving OCR analytics', {
        bolDocumentId: analyticsData.bolDocumentId,
        processingTime: analyticsData.processingTime
      });
      
      const savedAnalytics = await this.repository.createOcrAnalytics(analyticsData);
      return savedAnalytics;
    } catch (error) {
      logger.error('BOL-Service', 'Error saving OCR analytics', error);
      // We don't want to fail the whole operation if analytics saving fails
      // so we just log the error and return null
      return null;
    }
  }
  
  /**
   * Link a BOL document to an appointment
   * 
   * @param {number} documentId - ID of the BOL document
   * @param {number} scheduleId - ID of the appointment/schedule
   * @returns {Promise<Object>} - Created link
   */
  async linkBolToAppointment(documentId, scheduleId) {
    try {
      logger.info('BOL-Service', `Linking BOL document ${documentId} to appointment ${scheduleId}`);
      
      const link = await this.repository.createBolAppointmentLink({
        bolDocumentId: documentId,
        scheduleId: scheduleId
      });
      
      return link;
    } catch (error) {
      logger.error('BOL-Service', 'Error linking BOL to appointment', error, {
        documentId,
        scheduleId
      });
      throw error;
    }
  }
  
  /**
   * Get all BOL documents for an appointment
   * 
   * @param {number} scheduleId - ID of the appointment/schedule
   * @returns {Promise<Array>} - Array of BOL documents
   */
  async getBolDocumentsForAppointment(scheduleId) {
    try {
      logger.info('BOL-Service', `Fetching BOL documents for appointment ${scheduleId}`);
      
      const documents = await this.repository.getBolDocumentsForSchedule(scheduleId);
      return documents;
    } catch (error) {
      logger.error('BOL-Service', 'Error fetching BOL documents for appointment', error, {
        scheduleId
      });
      throw error;
    }
  }
  
  /**
   * Get a BOL document by ID
   * 
   * @param {number} id - ID of the BOL document
   * @returns {Promise<Object|null>} - BOL document or null if not found
   */
  async getBolDocumentById(id) {
    try {
      logger.info('BOL-Service', `Fetching BOL document ${id}`);
      
      const document = await this.repository.getBolDocument(id);
      return document;
    } catch (error) {
      logger.error('BOL-Service', 'Error fetching BOL document', error, {
        documentId: id
      });
      throw error;
    }
  }
  
  /**
   * Update a BOL document's OCR data
   * 
   * @param {number} id - ID of the BOL document
   * @param {Object} ocrData - New OCR data
   * @returns {Promise<Object>} - Updated document
   */
  async updateBolDocumentOcrData(id, ocrData) {
    try {
      logger.info('BOL-Service', `Updating OCR data for BOL document ${id}`);
      
      const parsedData = ocrData?.metadata ? JSON.stringify(ocrData.metadata) : null;
      
      const updatedDocument = await this.repository.updateBolDocument(id, {
        ocrData: JSON.stringify(ocrData),
        parsedData,
        ocrStatus: 'completed'
      });
      
      return updatedDocument;
    } catch (error) {
      logger.error('BOL-Service', 'Error updating BOL document OCR data', error, {
        documentId: id
      });
      throw error;
    }
  }

  /**
   * Process and save a BOL document, optionally linking it to an appointment
   * 
   * @param {Object} fileInfo - Information about the uploaded file
   * @param {number} tenantId - ID of the tenant
   * @param {number} userId - ID of the user who uploaded the document
   * @param {number|null} scheduleId - Optional ID of the appointment to link with
   * @returns {Promise<Object>} - Result of processing and saving
   */
  async processAndSaveBolDocument(fileInfo, tenantId, userId, scheduleId = null) {
    try {
      logger.info('BOL-Service', `Processing and saving BOL document`, {
        fileName: fileInfo.originalName,
        tenantId,
        userId,
        scheduleId
      });
      
      // Determine if file is processable by OCR
      const processableTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
      const canProcess = processableTypes.includes(fileInfo.mimetype);
      
      let ocrResult = null;
      let status = 'pending';
      
      // Attempt OCR processing if file type is supported
      if (canProcess) {
        try {
          logger.info('BOL-Service', `Starting OCR processing for file: ${fileInfo.path}`);
          ocrResult = await this.processImageWithTimeout(fileInfo.path);
          status = 'completed';
          
          logger.info('BOL-Service', 'OCR processing completed', {
            success: ocrResult.validation?.success || false,
            fieldsExtracted: Object.keys(ocrResult.metadata || {}).length
          });
        } catch (ocrError) {
          logger.error('BOL-Service', 'OCR processing failed', ocrError, {
            filePath: fileInfo.path
          });
          status = 'failed';
        }
      } else {
        logger.info('BOL-Service', `File type not supported for OCR processing: ${fileInfo.mimetype}`);
        status = 'skipped';
      }
      
      // Save the document to the database regardless of OCR result
      const savedDocument = await this.saveBolDocument(
        fileInfo,
        ocrResult,
        tenantId,
        userId,
        status
      );
      
      logger.info('BOL-Service', `BOL document saved to database with ID: ${savedDocument.id}`);
      
      // Link to appointment if scheduleId is provided
      let linkCreated = false;
      if (scheduleId && savedDocument.id) {
        try {
          const link = await this.linkBolToAppointment(savedDocument.id, scheduleId);
          linkCreated = !!link;
          
          logger.info('BOL-Service', `BOL document linked to appointment`, {
            documentId: savedDocument.id,
            scheduleId,
            linkId: link?.id
          });
        } catch (linkError) {
          logger.error('BOL-Service', 'Error linking BOL to appointment', linkError, {
            documentId: savedDocument.id,
            scheduleId
          });
          // Don't fail the whole operation if linking fails
        }
      }
      
      // Return the results
      return {
        documentId: savedDocument.id,
        ocrResult,
        linkCreated,
        status
      };
      
    } catch (error) {
      logger.error('BOL-Service', 'Error processing and saving BOL document', error, {
        fileName: fileInfo.originalName
      });
      throw error;
    }
  }
}