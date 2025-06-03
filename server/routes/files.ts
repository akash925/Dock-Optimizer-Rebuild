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