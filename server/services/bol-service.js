/**
 * BOL Service - Simple implementation
 * 
 * Handles BOL document processing and database interactions
 * without complex dependencies
 */

const fs = require('fs');
const path = require('path');
const { pool } = require('../db');
const logger = require('../logger');

/**
 * Save BOL document information to the database
 * 
 * @param {Object} fileInfo - Information about the uploaded file
 * @param {Object} ocrResult - OCR processing results (can be null)
 * @param {number} tenantId - ID of the tenant
 * @param {number} userId - ID of the user who uploaded the document
 * @returns {Promise<Object>} - Saved document information
 */
async function saveBolDocument(fileInfo, ocrResult, tenantId, userId) {
  try {
    // Convert objects to JSON strings for database storage
    const ocrDataJson = ocrResult ? JSON.stringify(ocrResult) : null;
    const parsedDataJson = ocrResult && ocrResult.metadata ? JSON.stringify(ocrResult.metadata) : null;
    
    // Determine OCR status based on result
    const ocrStatus = ocrResult && ocrResult.success !== false ? 'completed' : 'failed';
    
    // Insert into database
    const query = `
      INSERT INTO bol_documents 
      (file_name, original_file_name, file_path, file_size, mime_type, 
       tenant_id, uploaded_by, ocr_data, parsed_data, ocr_status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING *
    `;
    
    const values = [
      fileInfo.name,
      fileInfo.originalName,
      fileInfo.path,
      fileInfo.size,
      fileInfo.mimetype,
      tenantId,
      userId,
      ocrDataJson,
      parsedDataJson,
      ocrStatus
    ];
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('Failed to save BOL document to database');
    }
    
    logger.info('BOL-Service', `Saved BOL document to database: ${result.rows[0].id}`, {
      documentId: result.rows[0].id,
      status: ocrStatus
    });
    
    return result.rows[0];
  } catch (error) {
    logger.error('BOL-Service', 'Error saving BOL document', error);
    throw error;
  }
}

/**
 * Link a BOL document to an appointment
 * 
 * @param {number} documentId - ID of the BOL document
 * @param {number} scheduleId - ID of the appointment/schedule
 * @returns {Promise<Object>} - Created link information
 */
async function linkBolToAppointment(documentId, scheduleId) {
  try {
    const query = `
      INSERT INTO appointment_bol_links 
      (bol_document_id, schedule_id, created_at)
      VALUES ($1, $2, NOW())
      RETURNING *
    `;
    
    const values = [documentId, scheduleId];
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('Failed to link BOL document to appointment');
    }
    
    logger.info('BOL-Service', `Linked BOL document ${documentId} to appointment ${scheduleId}`);
    
    return result.rows[0];
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
async function getBolDocumentsForAppointment(scheduleId) {
  try {
    const query = `
      SELECT bd.* 
      FROM bol_documents bd
      JOIN appointment_bol_links abl ON bd.id = abl.bol_document_id
      WHERE abl.schedule_id = $1
      ORDER BY bd.created_at DESC
    `;
    
    const values = [scheduleId];
    
    const result = await pool.query(query, values);
    
    // Parse the JSON fields
    const documents = result.rows.map(doc => ({
      ...doc,
      ocrData: doc.ocr_data ? JSON.parse(doc.ocr_data) : null,
      parsedData: doc.parsed_data ? JSON.parse(doc.parsed_data) : null
    }));
    
    logger.info('BOL-Service', `Retrieved ${documents.length} BOL documents for appointment ${scheduleId}`);
    
    return documents;
  } catch (error) {
    logger.error('BOL-Service', 'Error retrieving BOL documents for appointment', error, {
      scheduleId
    });
    throw error;
  }
}

/**
 * Process a BOL image with OCR and save it to the database
 * 
 * @param {Object} fileInfo - Information about the uploaded file
 * @param {number} tenantId - ID of the tenant
 * @param {number} userId - ID of the user who uploaded the document
 * @param {number} scheduleId - Optional ID of the appointment/schedule to link to
 * @returns {Promise<Object>} - Processing results and saved document information
 */
async function processAndSaveBolDocument(fileInfo, tenantId, userId, scheduleId) {
  try {
    logger.info('BOL-Service', `Processing and saving BOL document: ${fileInfo.originalName}`);
    
    // For now, we'll create a placeholder OCR result
    // In a real implementation, this would call the OCR service
    const ocrResult = {
      success: true,
      metadata: {
        bolNumber: extractBolNumberFromFilename(fileInfo.originalName),
        processingTimestamp: new Date().toISOString()
      }
    };
    
    // Save to database
    const savedDocument = await saveBolDocument(fileInfo, ocrResult, tenantId, userId);
    
    // Link to appointment if scheduleId is provided
    if (scheduleId) {
      await linkBolToAppointment(savedDocument.id, scheduleId);
    }
    
    return {
      success: true,
      documentId: savedDocument.id,
      ocrResult,
      documentInfo: savedDocument
    };
  } catch (error) {
    logger.error('BOL-Service', 'Error processing and saving BOL document', error);
    
    // Even if OCR fails, try to save the document
    try {
      const savedDocument = await saveBolDocument(
        fileInfo, 
        { success: false, error: error.message },
        tenantId,
        userId
      );
      
      if (scheduleId) {
        await linkBolToAppointment(savedDocument.id, scheduleId);
      }
      
      return {
        success: false,
        documentId: savedDocument.id,
        error: error.message,
        documentInfo: savedDocument
      };
    } catch (saveError) {
      logger.error('BOL-Service', 'Error saving BOL document after processing failure', saveError);
      throw saveError;
    }
  }
}

/**
 * Extract BOL number from filename (placeholder implementation)
 * 
 * @param {string} filename - Original filename
 * @returns {string} - Extracted BOL number or placeholder
 */
function extractBolNumberFromFilename(filename) {
  // Try to extract a BOL number from the filename
  const bolMatch = filename.match(/BOL[-_]?(\d+)/i);
  if (bolMatch) {
    return bolMatch[1];
  }
  
  // Generate a random BOL number
  return `HZL-${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`;
}

module.exports = {
  saveBolDocument,
  linkBolToAppointment,
  getBolDocumentsForAppointment,
  processAndSaveBolDocument
};