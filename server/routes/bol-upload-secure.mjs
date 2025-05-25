/**
 * BOL Upload Routes (ESM Version) - Enhanced Security
 * 
 * Implements secure API endpoints for uploading Bill of Lading (BOL) 
 * documents and linking them to appointments with proper validation,
 * tenant isolation, and RBAC.
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { BolService } from '../services/bol-service.js';
import { z } from 'zod';

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

// Validation schemas
const bolLinkSchema = z.object({
  documentId: z.number({
    required_error: "Document ID is required",
    invalid_type_error: "Document ID must be a number"
  }).int().positive(),
  scheduleId: z.number({
    required_error: "Schedule ID is required",
    invalid_type_error: "Schedule ID must be a number"
  }).int().positive()
});

// Authentication middleware
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ 
    success: false,
    error: 'Authentication required' 
  });
};

// File size and type limits for uploads
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only PDF, images, and common document formats
    const allowedMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, images, and Office documents are allowed.'), false);
    }
  }
});

/**
 * @api {post} /api/bol-upload/link Link BOL Document to Appointment
 * @apiDescription Link an existing BOL document to an appointment with tenant isolation
 * @apiName LinkBOLToAppointment
 * 
 * @apiParam {Number} documentId ID of the BOL document
 * @apiParam {Number} scheduleId ID of the appointment/schedule
 * 
 * @apiSuccess {Object} result Link creation result
 */
router.post('/link', isAuthenticated, async (req, res) => {
  try {
    // Parse and validate request body
    let validatedData;
    try {
      // Convert string values to numbers if needed
      const parsedBody = {
        ...req.body,
        documentId: parseInt(req.body.documentId, 10),
        scheduleId: parseInt(req.body.scheduleId, 10)
      };
      
      validatedData = bolLinkSchema.parse(parsedBody);
    } catch (validationError) {
      console.error('BOL-Link validation error:', validationError);
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: validationError.errors || validationError.message
      });
    }
    
    const { documentId, scheduleId } = validatedData;
    
    // Check if the user has access to this schedule based on tenant
    const userTenantId = req.user?.tenantId;
    
    // Check if the user is a super-admin (bypass tenant check)
    const isSuperAdmin = req.user?.role === 'super-admin';
    
    if (!isSuperAdmin && userTenantId) {
      try {
        // Get the schedule and check its facility's tenant
        const schedule = await bolService.getScheduleById(scheduleId);
        if (!schedule) {
          return res.status(404).json({
            success: false,
            error: 'Schedule not found'
          });
        }
        
        // If the schedule has a facilityId, check the facility's tenant
        if (schedule.facilityId) {
          const facility = await bolService.getFacilityById(schedule.facilityId);
          
          if (facility && facility.tenantId !== userTenantId) {
            console.warn(`Security violation: User from tenant ${userTenantId} attempted to access schedule ${scheduleId} belonging to facility from tenant ${facility.tenantId}`);
            
            return res.status(403).json({
              success: false,
              error: 'You do not have permission to access this schedule'
            });
          }
        }
      } catch (error) {
        console.error('Error checking tenant access:', error);
        return res.status(500).json({
          success: false,
          error: 'Error verifying access permissions'
        });
      }
    }
    
    // Link document to appointment
    const result = await bolService.linkBolToAppointment(documentId, scheduleId);
    
    // Return the results
    res.status(200).json({
      success: true,
      linkId: result.id,
      message: 'BOL document linked to appointment successfully'
    });
    
  } catch (error) {
    console.error('Error linking BOL document to appointment:', error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to link BOL document to appointment'
    });
  }
});

/**
 * @api {get} /api/bol-upload/document/:id Get BOL Document
 * @apiDescription Retrieve a BOL document by ID with tenant isolation
 * @apiName GetBOLDocument
 * 
 * @apiParam {Number} id Document ID
 * 
 * @apiSuccess {Object} document BOL document data
 */
router.get('/document/:id', isAuthenticated, async (req, res) => {
  try {
    const documentId = parseInt(req.params.id, 10);
    
    if (isNaN(documentId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid document ID'
      });
    }
    
    // Get the document
    const document = await bolService.getBolDocument(documentId);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }
    
    // Check tenant access for non-super-admins
    const userTenantId = req.user?.tenantId;
    const isSuperAdmin = req.user?.role === 'super-admin';
    
    if (!isSuperAdmin && userTenantId && document.tenantId && document.tenantId !== userTenantId) {
      console.warn(`Security violation: User from tenant ${userTenantId} attempted to access BOL document ${documentId} from tenant ${document.tenantId}`);
      
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to access this document'
      });
    }
    
    // Return the document
    res.status(200).json({
      success: true,
      document
    });
    
  } catch (error) {
    console.error('Error retrieving BOL document:', error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to retrieve BOL document'
    });
  }
});

export default router;