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
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const documentValidator = require('../utils/documentValidator');
const ocrValidator = require('../utils/ocrValidator');
const metricsLogger = require('../utils/metrics-logger');

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
    
    // Log metrics for document processing
    if (ocrResult) {
      const fileExt = path.extname(fileInfo.name).toLowerCase().substring(1);
      metricsLogger.recordDocumentProcessingMetrics({
        documentType: fileInfo.mimetype || fileExt,
        documentSize: fileInfo.size,
        processingTime: ocrResult.metadata?.processingTimeMs || 0,
        success: ocrStatus === 'completed',
        errorType: ocrResult.error || null,
        tenantId
      });
    }
    
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
    
    // Process the document with OCR
    const startTime = Date.now();
    const ocrResult = await processDocumentWithOCR(fileInfo.path);
    const processingTime = Date.now() - startTime;
    
    // Enhance OCR result with additional metadata
    ocrResult.metadata = {
      ...ocrResult.metadata,
      processingTimestamp: new Date().toISOString(),
      processingTimeMs: processingTime,
      originalFilename: fileInfo.originalName,
      fileSize: fileInfo.size
    };
    
    // If OCR didn't extract a BOL number, try to get it from the filename
    if (!ocrResult.metadata.bolNumber) {
      ocrResult.metadata.bolNumber = extractBolNumberFromFilename(fileInfo.originalName);
      ocrResult.metadata.bolNumberSource = 'filename';
    } else {
      ocrResult.metadata.bolNumberSource = 'ocr';
    }
    
    logger.info('BOL-Service', `OCR processing completed in ${processingTime}ms`, {
      success: ocrResult.success,
      fileSize: fileInfo.size,
      processingTime
    });
    
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
 * Process a document with OCR to extract BOL information
 * 
 * @param {string} filePath - Path to the document file
 * @returns {Promise<Object>} - OCR processing results
 */
async function processDocumentWithOCR(filePath) {
  try {
    logger.info('BOL-Service', `Starting OCR processing for: ${filePath}`);
    
    // Check if the file exists
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        error: 'File not found',
        metadata: {}
      };
    }
    
    // Validate the document for OCR processing
    const validationResult = ocrValidator.validateDocumentForOcr(filePath);
    if (!validationResult.isValid) {
      logger.warn('BOL-Service', `Document validation failed for OCR: ${validationResult.error}`, {
        details: validationResult.details,
        filePath
      });
      
      return {
        success: false,
        error: validationResult.error,
        details: validationResult.details,
        metadata: {
          validationFailed: true,
          validationDetails: validationResult.details,
          processingTimestamp: new Date().toISOString()
        }
      };
    }
    
    // Log validation results
    logger.info('BOL-Service', `Document validated for OCR processing`, {
      filePath,
      fileSize: validationResult.fileSize,
      hasExtractableText: validationResult.hasExtractableText,
      needsOcr: validationResult.needsOcr,
      pageCount: validationResult.pageCount,
      warning: validationResult.warning
    });
    
    // Default result structure
    const result = {
      success: false,
      metadata: {
        validationResults: {
          fileSize: validationResult.fileSize,
          hasExtractableText: validationResult.hasExtractableText,
          needsOcr: validationResult.needsOcr,
          pageCount: validationResult.pageCount,
          width: validationResult.width,
          height: validationResult.height,
          format: validationResult.format
        }
      }
    };
    
    try {
      // Call the Python OCR script to process the document
      const scriptPath = path.join(process.cwd(), 'server', 'utils', 'ocr_processor.py');
      
      // Set a timeout for OCR processing (10 seconds)
      const { stdout, stderr } = await execPromise(`python ${scriptPath} "${filePath}"`, {
        timeout: 10000 // 10 seconds
      });
      
      if (stderr) {
        logger.warn('BOL-Service', `OCR processing stderr: ${stderr}`);
      }
      
      // Parse the OCR results
      if (stdout) {
        try {
          const ocrData = JSON.parse(stdout);
          result.success = true;
          result.metadata = {
            bolNumber: ocrData.bol_number || null,
            customerName: ocrData.customer_name || null,
            carrierName: ocrData.carrier_name || null,
            shipDate: ocrData.ship_date || null,
            deliveryDate: ocrData.delivery_date || null,
            detectedText: ocrData.text || null,
            confidence: ocrData.confidence || 0
          };
          
          // If specific fields were found, mark extraction as successful
          if (ocrData.bol_number || ocrData.customer_name || ocrData.carrier_name) {
            result.extractionSuccess = true;
          }
        } catch (parseError) {
          logger.error('BOL-Service', 'Error parsing OCR output', parseError, { stdout });
          result.error = 'Error parsing OCR output';
          result.rawOutput = stdout.substring(0, 500); // Store truncated raw output for debugging
        }
      } else {
        result.error = 'OCR process produced no output';
      }
    } catch (ocrError) {
      logger.error('BOL-Service', 'Error during OCR processing', ocrError);
      
      // Handle timeout specifically
      if (ocrError.code === 'ETIMEDOUT' || (ocrError.message && ocrError.message.includes('timeout'))) {
        result.error = 'OCR processing timed out';
      } else {
        result.error = `OCR processing error: ${ocrError.message}`;
      }
    }
    
    // If OCR failed but the document exists, still consider this a partial success
    // so the document can be stored and processed manually
    if (!result.success && fs.existsSync(filePath)) {
      result.success = true; // Document exists and was saved
      result.ocrFailed = true; // But OCR processing failed
      result.metadata = result.metadata || {};
      result.metadata.ocrError = result.error;
    }
    
    return result;
  } catch (error) {
    logger.error('BOL-Service', 'Unexpected error in processDocumentWithOCR', error);
    return {
      success: false,
      error: error.message,
      metadata: {}
    };
  }
}

/**
 * Extract BOL number from filename
 * 
 * @param {string} filename - Original filename
 * @returns {string} - Extracted BOL number or generated placeholder
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