/**
 * BOL OCR Routes
 * 
 * API endpoints for processing Bill of Lading (BOL) images using OCR.
 * Enhanced with timeout handling, validation, database storage, and metrics logging.
 * 
 * @module server/routes/bol-ocr
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { processImageFile, processBase64Image, testOcr } from '../ocr/ocr_connector.mjs';
import { BolService } from '../services/bolService.js';
import { validateOcrResult, extractFieldsFromOcrResults } from '../utils/ocrValidator.mjs';
import logger from '../logger.js';
import { getStorage } from '../storage.js';

const router = express.Router();
const bolService = new BolService();

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'bol');
    
    // Create the upload directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate a unique filename with timestamp and original extension
    const extension = path.extname(file.originalname);
    const filename = `bol_${Date.now()}${extension}`;
    cb(null, filename);
  }
});

// File filter to only allow images and PDFs
const fileFilter = (req, file, cb) => {
  // Accept only image files and PDFs
  if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only image files and PDFs are allowed for BOL processing'), false);
  }
};

// Configure multer upload
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 MB file size limit
  }
});

/**
 * @api {post} /api/bol-ocr/upload Process BOL image upload
 * @apiDescription Upload a BOL image and process it with OCR
 * @apiName UploadBOL
 * @apiGroup BOL OCR
 * 
 * @apiParam {File} bolImage The BOL image file to process
 * @apiParam {Number} [scheduleId] Optional ID of the appointment to associate with this BOL
 * 
 * @apiSuccess {Boolean} success Whether the OCR processing was successful
 * @apiSuccess {Object} data The OCR processing results
 * @apiSuccess {Object} documentInfo Database record of the saved document
 */
router.post('/upload', upload.single('bolImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded.' });
    }

    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    const scheduleId = req.body.scheduleId ? parseInt(req.body.scheduleId, 10) : null;
    const storage = await getStorage();

    // Immediately create an OCR job record in a 'queued' state
    const ocrJob = await storage.createOcrJob({
      tenantId: tenantId,
      originalFileName: req.file.originalname,
      storedFileName: req.file.filename,
      filePath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      status: 'queued',
      scheduleId: scheduleId,
      uploadedBy: userId,
    });

    // In a real implementation, a separate worker process would pick this up.
    // For now, we'll trigger it asynchronously without awaiting the result.
    processOcrJob(ocrJob.id);

    res.status(202).json({
      success: true,
      message: 'Document uploaded and queued for processing.',
      jobId: ocrJob.id,
    });
  } catch (error) {
    logger.error('BOL-OCR', 'Unexpected error in BOL upload handler', error);
    res.status(500).json({
      success: false,
      error: error.message || 'An unexpected error occurred during the BOL upload process.',
    });
  }
});

// This function simulates a background worker processing a job.
async function processOcrJob(jobId) {
  const storage = await getStorage();
  let ocrJob = await storage.getOcrJob(jobId);

  if (!ocrJob) {
    logger.error('BOL-OCR-WORKER', `Job ${jobId} not found.`);
    return;
  }

  try {
    await storage.updateOcrJob(jobId, { status: 'processing', startedAt: new Date() });

    const ocrResult = await bolService.processImageWithTimeout(ocrJob.filePath);
    
    await storage.updateOcrJob(jobId, { 
      status: 'completed', 
      completedAt: new Date(),
      resultData: ocrResult 
    });

    logger.info('BOL-OCR-WORKER', `Job ${jobId} completed successfully.`);

  } catch (error) {
    logger.error('BOL-OCR-WORKER', `Job ${jobId} failed`, error);
    await storage.updateOcrJob(jobId, { 
      status: 'failed',
      completedAt: new Date(),
      resultData: { error: error.message }
    });
  }
}

/**
 * @api {post} /api/bol-ocr/process-base64 Process BOL base64 image
 * @apiDescription Process a base64-encoded BOL image with OCR
 * @apiName ProcessBase64BOL
 * @apiGroup BOL OCR
 * 
 * @apiParam {String} imageData Base64-encoded image data
 * @apiParam {Number} [scheduleId] Optional ID of the appointment to associate with this BOL
 * 
 * @apiSuccess {Boolean} success Whether the OCR processing was successful
 * @apiSuccess {Object} data The OCR processing results
 * @apiSuccess {Object} documentInfo Database record of the saved document
 */
router.post('/process-base64', async (req, res) => {
  try {
    const { imageData, scheduleId } = req.body;
    
    // Validate the request
    if (!imageData) {
      return res.status(400).json({
        success: false,
        error: 'No image data provided. Please provide base64-encoded image data.'
      });
    }
    
    // Get the tenant ID and user ID from the authenticated session if available
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    const appointmentId = scheduleId ? parseInt(scheduleId, 10) : null;
    
    // Start tracking processing time for metrics
    const startTime = Date.now();
    
    // Generate a filename for logging purposes
    const filename = `base64_image_${Date.now()}`;
    logger.info('BOL-OCR', `Processing base64 image (${filename})`);
    
    let ocrResult = null;
    let ocrStatus = 'failed'; // Default to failed, will update if successful
    
    try {
      // Process the base64 image data with timeout handling
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('OCR processing timed out')), 30000); // 30 seconds timeout
      });
      
      // Race the OCR processing against the timeout
      ocrResult = await Promise.race([
        processBase64Image(imageData),
        timeoutPromise
      ]);
      
      // If we got here, OCR was successful
      ocrStatus = 'completed';
      
      // Calculate processing time for metrics
      const processingTime = (Date.now() - startTime) / 1000; // Convert to seconds
      if (ocrResult && typeof ocrResult === 'object') {
        ocrResult.processingTime = processingTime;
      }
      
      logger.info('BOL-OCR', 'Base64 OCR processing successful', {
        processingTime
      });
      
      // Extract fields from OCR results
      if (validateOcrResult(ocrResult)) {
        ocrResult.metadata = extractFieldsFromOcrResults(ocrResult);
      }
    } catch (ocrError) {
      // Log the OCR error but continue processing to save the image
      logger.error('BOL-OCR', 'Error processing base64 image with OCR', ocrError);
      
      // Create a minimal result object to indicate failure but still allow file storage
      ocrResult = {
        success: false,
        error: ocrError.message || 'OCR processing failed',
        processingTime: (Date.now() - startTime) / 1000
      };
    }
    
    // Generate a more descriptive filename for storage
    const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
    const storageFilename = `bol_base64_${timestamp}.png`;
    
    // Save the base64 image to a file
    const imageBuffer = Buffer.from(imageData.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'bol');
    
    // Create the upload directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    const filePath = path.join(uploadDir, storageFilename);
    
    try {
      fs.writeFileSync(filePath, imageBuffer);
      
      // File info for database storage
      const fileInfo = {
        originalName: `bol_image_${timestamp}.png`,
        name: storageFilename,
        path: filePath,
        size: imageBuffer.length,
        mimetype: 'image/png'
      };
      
      // Save the document to the database
      const savedDocument = await bolService.saveBolDocument(
        fileInfo,
        ocrResult,
        tenantId,
        userId,
        ocrStatus
      );
      
      logger.info('BOL-OCR', `Base64 document saved to database with ID ${savedDocument.id}`, {
        status: ocrStatus,
        tenantId
      });
      
      // If a schedule ID was provided, link the BOL to the appointment
      if (appointmentId && !isNaN(appointmentId)) {
        await bolService.linkBolToAppointment(savedDocument.id, appointmentId);
        logger.info('BOL-OCR', `Linked BOL document ${savedDocument.id} to appointment ${appointmentId}`);
      }
      
      // Prepare response object
      const result = {
        success: true,
        ocrSuccess: ocrStatus === 'completed',
        ocrData: ocrResult,
        file: fileInfo,
        documentInfo: {
          id: savedDocument.id,
          status: ocrStatus,
          createdAt: savedDocument.createdAt
        }
      };
      
      // Return the results
      res.json(result);
    } catch (fileError) {
      logger.error('BOL-OCR', 'Error saving base64 image to file', fileError);
      
      // Still return the OCR results even if file saving failed
      res.status(207).json({
        success: ocrStatus === 'completed',
        partialSuccess: true,
        message: 'OCR processing completed but file storage failed',
        error: fileError.message,
        ocrData: ocrResult
      });
    }
    
  } catch (error) {
    logger.error('BOL-OCR', 'Unexpected error in base64 BOL processing', error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'An unexpected error occurred during base64 image processing.'
    });
  }
});

/**
 * @api {get} /api/bol-ocr/documents/:scheduleId Get BOL documents for appointment
 * @apiDescription Get all BOL documents associated with an appointment/schedule
 * @apiName GetBOLDocumentsForAppointment
 * @apiGroup BOL OCR
 * 
 * @apiParam {Number} scheduleId ID of the appointment/schedule
 * 
 * @apiSuccess {Boolean} success Whether the operation was successful
 * @apiSuccess {Array} documents Array of BOL documents associated with the appointment
 */
router.get('/documents/:scheduleId', async (req, res) => {
  try {
    const scheduleId = parseInt(req.params.scheduleId, 10);
    
    if (isNaN(scheduleId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid schedule ID. Please provide a valid numeric ID.'
      });
    }
    
    // Get the tenant ID from the authenticated session
    const tenantId = req.user?.tenantId;
    
    // Get all BOL documents for the appointment
    const documents = await bolService.getBolDocumentsForAppointment(scheduleId);
    
    // Return the documents
    res.json({
      success: true,
      documents: documents.map(doc => ({
        id: doc.id,
        fileName: doc.fileName,
        originalFileName: doc.originalFileName,
        filePath: doc.filePath,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        ocrStatus: doc.ocrStatus,
        createdAt: doc.createdAt,
        parsedData: doc.parsedData
      }))
    });
    
  } catch (error) {
    logger.error('BOL-OCR', 'Error getting BOL documents for appointment', error, {
      scheduleId: req.params.scheduleId
    });
    
    res.status(500).json({
      success: false,
      error: error.message || 'An error occurred while retrieving BOL documents for the appointment.'
    });
  }
});

/**
 * @api {get} /api/bol-ocr/document/:id Get BOL document by ID
 * @apiDescription Get a BOL document by its ID
 * @apiName GetBOLDocument
 * @apiGroup BOL OCR
 * 
 * @apiParam {Number} id ID of the BOL document
 * 
 * @apiSuccess {Boolean} success Whether the operation was successful
 * @apiSuccess {Object} document BOL document
 */
router.get('/document/:id', async (req, res) => {
  try {
    const documentId = parseInt(req.params.id, 10);
    
    if (isNaN(documentId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid document ID. Please provide a valid numeric ID.'
      });
    }
    
    // Get the document
    const document = await bolService.getBolDocumentById(documentId);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found.'
      });
    }
    
    // Return the document
    res.json({
      success: true,
      document: {
        id: document.id,
        fileName: document.fileName,
        originalFileName: document.originalFileName,
        filePath: document.filePath,
        fileSize: document.fileSize,
        mimeType: document.mimeType,
        ocrStatus: document.ocrStatus,
        createdAt: document.createdAt,
        parsedData: document.parsedData
      }
    });
    
  } catch (error) {
    logger.error('BOL-OCR', 'Error getting BOL document', error, {
      documentId: req.params.id
    });
    
    res.status(500).json({
      success: false,
      error: error.message || 'An error occurred while retrieving the BOL document.'
    });
  }
});

/**
 * @api {get} /api/bol-ocr/test Test OCR functionality
 * @apiDescription Test the OCR functionality with a sample image
 * @apiName TestOCR
 * @apiGroup BOL OCR
 * 
 * @apiSuccess {Boolean} success Whether the OCR test was successful
 * @apiSuccess {String} message Test result message
 * @apiSuccess {String} [detectedText] The text detected in the test image (if successful)
 */
router.get('/test', async (req, res) => {
  try {
    logger.info('BOL-OCR', 'Running OCR test');
    
    // Run the OCR test
    const result = await testOcr();
    
    // Log test results
    if (result.success) {
      logger.info('BOL-OCR', 'OCR test successful', {
        message: result.message
      });
    } else {
      logger.warn('BOL-OCR', 'OCR test failed', {
        message: result.message,
        error: result.error
      });
    }
    
    // Return the test results
    res.json(result);
    
  } catch (error) {
    logger.error('BOL-OCR', 'Error testing OCR', error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'An error occurred while testing the OCR functionality.'
    });
  }
});

/**
 * @api {post} /api/bol-ocr/extract-fields Extract fields from BOL OCR results
 * @apiDescription Extract specific fields from BOL OCR results 
 * @apiName ExtractFieldsBOL
 * @apiGroup BOL OCR
 * 
 * @apiParam {Object} ocrResults The OCR results from processing a BOL image
 * 
 * @apiSuccess {Boolean} success Whether the field extraction was successful
 * @apiSuccess {Object} extractedFields The extracted fields from the BOL
 */
router.post('/extract-fields', async (req, res) => {
  try {
    const { ocrResults } = req.body;
    
    // Validate the request
    if (!ocrResults) {
      return res.status(400).json({
        success: false,
        error: 'No OCR results provided. Please provide OCR results to extract fields from.'
      });
    }
    
    // Extract common fields from the OCR results
    const extractedFields = extractFieldsFromOcrResults(ocrResults);
    
    // Return the extracted fields
    res.json({
      success: true,
      extractedFields
    });
    
  } catch (error) {
    logger.error('BOL-OCR', 'Error extracting fields from BOL OCR results', error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'An error occurred while extracting fields from the BOL OCR results.'
    });
  }
});

// Export the router
export default router;