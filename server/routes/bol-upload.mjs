/**
 * BOL Upload Routes (ESM Version)
 * 
 * Simplified but robust API endpoints for uploading Bill of Lading (BOL) 
 * documents and linking them to appointments.
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { BolService } from '../services/bolService.js';
import logger from '../logger.js';
import { validateDocument } from '../utils/documentValidator.mjs';

// Get the directory name in ESM context
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();
const bolService = new BolService();

// Create upload directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'uploads', 'bol');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer storage for BOL uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Generate a unique filename with timestamp and original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `bol_${uniqueSuffix}${ext}`);
  }
});

// Configure multer with filesize limits and allowed formats
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Accept only images and PDFs
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Only images and PDF files are allowed'));
    }
    cb(null, true);
  }
});

/**
 * @api {post} /api/bol-upload/upload Upload BOL Document
 * @apiDescription Upload a BOL document and associate it with an appointment
 * @apiName UploadBOL
 * 
 * @apiParam {File} bolFile The BOL file to upload
 * @apiParam {Number} [scheduleId] Optional ID of the appointment to associate with this BOL
 * 
 * @apiSuccess {Object} result Upload and processing results
 */
router.post('/upload', upload.single('bolFile'), async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded. Please provide a BOL document file.'
      });
    }
    
    // Validate the uploaded document before processing
    const validationResult = validateDocument(req.file.path);
    if (!validationResult.isValid) {
      logger.warn('BOL-Upload', `Document validation failed: ${validationResult.error}`, {
        details: validationResult.details,
        filename: req.file.originalname
      });
      
      return res.status(400).json({
        success: false,
        error: validationResult.error,
        details: validationResult.details,
        message: 'The uploaded document could not be processed. Please check the file and try again.'
      });
    }
    
    // Get the tenant ID and user ID from the authenticated session if available
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    
    // Get the scheduleId from the form data if provided
    const scheduleId = req.body.scheduleId ? parseInt(req.body.scheduleId, 10) : null;
    
    // Log file details
    logger.info('BOL-Upload', `Processing BOL document: ${req.file.originalname}`, {
      size: req.file.size,
      tenantId
    });
    
    // File info for processing and storage
    const fileInfo = {
      name: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      size: req.file.size,
      mimetype: req.file.mimetype
    };
    
    logger.info('BOL-Upload', `Attempting to process and save document with scheduleId: ${scheduleId}`, {
      scheduleId,
      tenantId,
      userId
    });
    
    let result;
    let ocrSuccess = false;
    try {
      // Process and save document with better error handling
      result = await bolService.processAndSaveBolDocument(
        fileInfo,
        tenantId,
        userId,
        scheduleId
      );
      ocrSuccess = true;
      
      logger.info('BOL-Upload', `Document processed successfully`, {
        documentId: result.documentId,
        scheduleId,
        hasOcrResult: !!result.ocrResult
      });
    } catch (processingError) {
      // Still continue even if processing fails
      logger.error('BOL-Upload', `Error in document processing, but continuing`, processingError, {
        scheduleId,
        filename: req.file.originalname
      });
      
      // Create a minimal result if processing failed
      result = {
        documentId: null,
        ocrResult: null,
        linkCreated: false,
        error: processingError.message
      };
    }
    
    // Generate file URL for frontend access
    const fileUrl = `/uploads/bol/${req.file.filename}`;
    
    // Check if the document was linked to an appointment
    const appointmentLinked = result.linkCreated || false;
    
    // Return the results - ALWAYS return 200 unless file validation failed
    res.status(200).json({
      success: true,
      fileUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      documentId: result.documentId,
      metadata: result.ocrResult?.metadata || {},
      ocrSuccess,
      scheduleId: scheduleId, // Return the scheduleId to confirm linkage
      appointmentLinked,
      message: ocrSuccess 
        ? 'BOL document uploaded and processed successfully' 
        : 'BOL document uploaded successfully, but OCR processing had issues'
    });
    
  } catch (error) {
    logger.error('BOL-Upload', 'Error uploading BOL document', error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to upload and process BOL document'
    });
  }
});

/**
 * @api {get} /api/bol-upload/documents/:scheduleId Get BOL Documents for Appointment
 * @apiDescription Get all BOL documents associated with an appointment
 * @apiName GetAppointmentBOLs
 * 
 * @apiParam {Number} scheduleId ID of the appointment/schedule
 * 
 * @apiSuccess {Array} documents Array of BOL documents
 */
router.get('/documents/:scheduleId', async (req, res) => {
  try {
    const scheduleId = parseInt(req.params.scheduleId, 10);
    
    if (isNaN(scheduleId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid schedule ID'
      });
    }
    
    // Get BOL documents for appointment
    const documents = await bolService.getBolDocumentsForAppointment(scheduleId);
    
    // Return the documents
    res.status(200).json({
      success: true,
      documents: documents.map(doc => ({
        id: doc.id,
        fileName: doc.file_name,
        originalFileName: doc.original_file_name,
        fileUrl: `/uploads/bol/${doc.file_name}`,
        fileSize: doc.file_size,
        mimeType: doc.mime_type,
        ocrStatus: doc.ocr_status,
        parsedData: doc.parsedData,
        createdAt: doc.created_at
      }))
    });
    
  } catch (error) {
    logger.error('BOL-Upload', 'Error retrieving BOL documents', error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to retrieve BOL documents'
    });
  }
});

/**
 * @api {post} /api/bol-upload/link Link BOL Document to Appointment
 * @apiDescription Link an existing BOL document to an appointment
 * @apiName LinkBOLToAppointment
 * 
 * @apiParam {Number} documentId ID of the BOL document
 * @apiParam {Number} scheduleId ID of the appointment/schedule
 * 
 * @apiSuccess {Object} result Link creation result
 */
router.post('/link', async (req, res) => {
  try {
    const { documentId, scheduleId } = req.body;
    
    if (!documentId || !scheduleId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: documentId and scheduleId are required'
      });
    }
    
    // Link document to appointment
    const result = await bolService.linkBolToAppointment(
      parseInt(documentId, 10),
      parseInt(scheduleId, 10)
    );
    
    // Return the results
    res.status(200).json({
      success: true,
      linkId: result.id,
      message: 'BOL document linked to appointment successfully'
    });
    
  } catch (error) {
    logger.error('BOL-Upload', 'Error linking BOL document to appointment', error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to link BOL document to appointment'
    });
  }
});

export default router;