import express from "express";
import multer from "multer";
import { blobStorageService } from "../services/blob-storage";
import { getStorage } from "../storage";

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// More permissive upload for BOL documents
const bolUpload = multer({
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

// Upload organization logo
router.post('/upload/organization-logo', upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { organizationId } = req.body;
    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID is required' });
    }

    const storage = await getStorage();

    // Upload file to blob storage
    const uploadedFile = await blobStorageService.uploadFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      {
        folder: 'organization-logos',
        tenantId: parseInt(organizationId),
        uploadedBy: (req as any).user?.id
      }
    );

    // Store file record in database
    await storage.createFileRecord(uploadedFile);

    res.json({
      success: true,
      fileId: uploadedFile.id,
      url: uploadedFile.url,
      originalName: uploadedFile.originalName,
      size: uploadedFile.size
    });

  } catch (error) {
    console.error('Error uploading organization logo:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Serve uploaded files
router.get('/serve/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const storage = await getStorage();
    
    // Get file record from database
    const fileRecord = await storage.getFileRecord(fileId);
    if (!fileRecord) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Get file stream from blob storage
    const fileStream = blobStorageService.getFileStream(fileRecord.path);
    
    // Set appropriate headers
    res.setHeader('Content-Type', fileRecord.mimeType);
    res.setHeader('Content-Length', fileRecord.size);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    
    // Pipe file stream to response
    fileStream.pipe(res);

  } catch (error) {
    console.error('Error serving file:', error);
    res.status(500).json({ error: 'Failed to serve file' });
  }
});

// Get BOL documents for a specific appointment
router.get('/bol/appointment/:appointmentId', async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const storage = await getStorage();

    // Get the appointment first to check for BOL info
    const appointment = await storage.getSchedule(parseInt(appointmentId));
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Check if appointment has BOL file information in customFormData
    const bolFiles = [];
    const customData = appointment.customFormData as any;
    if (customData?.bolFileUploaded) {
      bolFiles.push({
        fileId: customData.bolFileId,
        filename: customData.bolFileName,
        appointmentId: appointmentId
      });
    }

    res.json({
      success: true,
      files: bolFiles,
      bolNumber: appointment.bolNumber
    });

  } catch (error) {
    console.error('Error fetching BOL files for appointment:', error);
    res.status(500).json({ error: 'Failed to fetch BOL files' });
  }
});

// Upload BOL document 
router.post('/upload/bol', bolUpload.single('bolFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No BOL file uploaded' });
    }

    const { scheduleId, appointmentId } = req.body;
    const storage = await getStorage();
    
    // Use scheduleId or appointmentId - they're the same thing
    const finalAppointmentId = appointmentId || scheduleId;

    // Upload file to blob storage
    const uploadedFile = await blobStorageService.uploadFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      {
        folder: 'bol-documents',
        tenantId: (req as any).user?.tenantId || 1,
        uploadedBy: (req as any).user?.id || 1
      }
    );

    // Store file record in database - skip for now, just track in appointment
    // await storage.createFileRecord(fileRecord);
    
    // 🔥 CRITICAL FIX: Update the appointment to indicate BOL was uploaded
    if (finalAppointmentId) {
      try {
        const appointment = await storage.getSchedule(parseInt(finalAppointmentId));
        if (appointment) {
          // Update appointment with BOL info
          await storage.updateSchedule(parseInt(finalAppointmentId), {
            bolNumber: req.body.bolNumber || uploadedFile.originalName,
            lastModifiedAt: new Date(),
            // Add custom data to track BOL upload
            customFormData: {
              ...(appointment.customFormData || {}),
              bolFileUploaded: true,
              bolFileId: uploadedFile.id,
              bolFileName: uploadedFile.originalName
            }
          });
          console.log(`[BOL Upload] Updated appointment ${finalAppointmentId} with BOL info`);
        }
      } catch (updateError) {
        console.error('[BOL Upload] Error updating appointment:', updateError);
        // Don't fail the upload if appointment update fails
      }
    }

    res.json({
      success: true,
      fileId: uploadedFile.id,
      fileUrl: uploadedFile.url,
      filename: uploadedFile.originalName,
      size: uploadedFile.size,
      documentId: uploadedFile.id,
      appointmentId: finalAppointmentId,
      message: 'BOL document uploaded successfully'
    });

  } catch (error) {
    console.error('Error uploading BOL document:', error);
    res.status(500).json({ error: 'Failed to upload BOL document' });
  }
});

// Delete file
router.delete('/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const storage = await getStorage();
    
    // Get file record
    const fileRecord = await storage.getFileRecord(fileId);
    if (!fileRecord) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Delete file from blob storage
    await blobStorageService.deleteFile(fileId, fileRecord.tenantId);
    
    // Delete file record from database
    await storage.deleteFileRecord(fileId);

    res.json({ success: true });

  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

export default router;