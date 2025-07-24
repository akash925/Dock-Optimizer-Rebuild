import { Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { getStorage } from '../../../storage';
import { blobStorageService } from '../../../services/blob-storage';
import { insertBolDocumentSchema, type BolDocument } from '@shared/schema';

// Configure multer for BOL document uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for BOL documents
  },
  fileFilter: (req, file, cb) => {
    // Allow PDFs, images, and document files for BOL
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/tiff',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedTypes.includes(file.mimetype) || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, image, and document files are allowed for BOL uploads'));
    }
  }
});

// Validation schemas
const uploadBolSchema = z.object({
  scheduleId: z.string().transform(val => parseInt(val, 10)).refine(val => !isNaN(val), {
    message: "Schedule ID must be a valid number"
  }),
});

const deleteBolSchema = z.object({
  bolId: z.string().transform(val => parseInt(val, 10)).refine(val => !isNaN(val), {
    message: "BOL ID must be a valid number"
  }),
});

const listBolsSchema = z.object({
  scheduleId: z.string().transform(val => parseInt(val, 10)).refine(val => !isNaN(val), {
    message: "Schedule ID must be a valid number"
  }),
});

export const uploadBol = async (req: Request, res: Response) => {
  try {
    // Validate authentication
    if (!req.user || !req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Validate file upload
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Validate request parameters
    const validation = uploadBolSchema.safeParse({ scheduleId: req.params.id });
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid schedule ID', 
        details: validation.error.issues 
      });
    }

    const { scheduleId } = validation.data;
    const storage = await getStorage();

    // Verify the schedule exists and user has access
    const schedule = await storage.getSchedule(scheduleId);
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    // Upload file to blob storage
    const uploadedFile = await blobStorageService.uploadFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      {
        folder: 'bol-documents',
        tenantId: req.user?.tenantId || 1,
        uploadedBy: req.user?.id
      }
    );

    // Create BOL document record
    const bolDocumentData = {
      scheduleId,
      fileKey: uploadedFile.id,
      fileName: uploadedFile.originalName,
      mimeType: uploadedFile.mimeType,
      pageCount: null, // Could be populated by OCR service later
      uploadedBy: req.user?.id,
    };

    // Validate BOL document data
    const validatedData = insertBolDocumentSchema.parse(bolDocumentData);

    // Insert BOL document record (we'll need to add this method to storage)
    const bolDocument = await storage.createBolDocument(validatedData);

    // Get signed URL for immediate access
    const signedUrl = await blobStorageService.getSignedUrl(uploadedFile.id);

    res.status(201).json({
      bolId: bolDocument.id,
      fileName: uploadedFile.originalName,
      url: signedUrl
    });

  } catch (error) {
    console.error('Error uploading BOL document:', error);
    res.status(500).json({ error: 'Failed to upload BOL document' });
  }
};

export const listBols = async (req: Request, res: Response) => {
  try {
    // Validate authentication
    if (!req.user || !req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Validate request parameters
    const validation = listBolsSchema.safeParse({ scheduleId: req.params.id });
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid schedule ID', 
        details: validation.error.issues 
      });
    }

    const { scheduleId } = validation.data;
    const storage = await getStorage();

    // Verify the schedule exists and user has access
    const schedule = await storage.getSchedule(scheduleId);
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    // Get BOL documents for this schedule
    const bolDocuments = await storage.getBolDocumentsByScheduleId(scheduleId);

    // Enhance with signed URLs and user information
    const enhancedDocs = await Promise.all(
      bolDocuments.map(async (doc) => {
        const signedUrl = doc.fileKey ? await blobStorageService.getSignedUrl(doc.fileKey) : null;
        const uploader = doc.uploadedBy ? await storage.getUser(doc.uploadedBy) : null;
        
        return {
          id: doc.id,
          fileName: doc.fileName,
          url: signedUrl,
          uploadedBy: uploader ? `${uploader.firstName} ${uploader.lastName}`.trim() : 'Unknown',
          createdAt: doc.createdAt
        };
      })
    );

    res.json(enhancedDocs);

  } catch (error) {
    console.error('Error listing BOL documents:', error);
    res.status(500).json({ error: 'Failed to list BOL documents' });
  }
};

export const deleteBol = async (req: Request, res: Response) => {
  try {
    // Validate authentication
    if (!req.user || !req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Validate request parameters
    const validation = deleteBolSchema.safeParse({ bolId: req.params.bolId });
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid BOL ID', 
        details: validation.error.issues 
      });
    }

    const { bolId } = validation.data;
    const storage = await getStorage();

    // Get the BOL document to check permissions
    const bolDocument = await storage.getBolDocumentById(bolId);
    if (!bolDocument) {
      return res.status(404).json({ error: 'BOL document not found' });
    }

    // Check permissions: allow if admin/super_admin or if user uploaded the document
    const userRole = req.user?.role;
    const canDelete = 
      userRole === 'admin' || 
      userRole === 'super_admin' || 
      bolDocument.uploadedBy === req.user?.id;

    if (!canDelete) {
      return res.status(403).json({ 
        error: 'You do not have permission to delete this BOL document' 
      });
    }

    // Delete the physical file from blob storage
    try {
      if (bolDocument.fileKey) {
        await blobStorageService.deleteFile(bolDocument.fileKey, req.user?.tenantId || 1);
      }
    } catch (fileError) {
      console.warn('Warning: Failed to delete physical file:', fileError);
      // Continue with database deletion even if file deletion fails
    }

    // Delete the database record
    await storage.deleteBolDocument(bolId);

    res.status(204).end();

  } catch (error) {
    console.error('Error deleting BOL document:', error);
    res.status(500).json({ error: 'Failed to delete BOL document' });
  }
};

// Export the multer middleware for use in routes
export const bolUploadMiddleware = upload.single('file'); 