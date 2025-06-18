import request from 'supertest';
import express from 'express';
import { uploadBol, listBols, deleteBol, bolUploadMiddleware } from '../controllers/bolController';

// Mock the dependencies
jest.mock('../../../storage');
jest.mock('../../../services/blob-storage');

const app = express();
app.use(express.json());

// Mock authentication middleware
app.use((req: any, res, next) => {
  req.user = {
    id: 1,
    tenantId: 1,
    role: 'admin'
  };
  next();
});

// Setup routes
app.post('/api/schedules/:id/bol', bolUploadMiddleware, uploadBol);
app.get('/api/schedules/:id/bol', listBols);
app.delete('/api/bol/:bolId', deleteBol);

describe('BOL Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/schedules/:id/bol', () => {
    it('should upload a BOL document successfully', async () => {
      const mockStorage = {
        getSchedule: jest.fn().mockResolvedValue({ id: 1, facilityId: 1 }),
        createBolDocument: jest.fn().mockResolvedValue({ id: 1, fileName: 'test.pdf' })
      };

      const mockBlobService = {
        uploadFile: jest.fn().mockResolvedValue({
          id: 'file-123',
          originalName: 'test.pdf',
          mimeType: 'application/pdf'
        }),
        getSignedUrl: jest.fn().mockResolvedValue('https://signed-url.com/test.pdf')
      };

      // Mock the imports
      require('../../../storage').getStorage = jest.fn().mockResolvedValue(mockStorage);
      require('../../../services/blob-storage').blobStorageService = mockBlobService;

      const response = await request(app)
        .post('/api/schedules/1/bol')
        .attach('file', Buffer.from('fake pdf content'), 'test.pdf')
        .expect(201);

      expect(response.body).toEqual({
        bolId: 1,
        fileName: 'test.pdf',
        url: 'https://signed-url.com/test.pdf'
      });

      expect(mockStorage.getSchedule).toHaveBeenCalledWith(1);
      expect(mockStorage.createBolDocument).toHaveBeenCalled();
      expect(mockBlobService.uploadFile).toHaveBeenCalled();
      expect(mockBlobService.getSignedUrl).toHaveBeenCalledWith('file-123');
    });

    it('should return 400 when no file is uploaded', async () => {
      const response = await request(app)
        .post('/api/schedules/1/bol')
        .expect(400);

      expect(response.body.error).toBe('No file uploaded');
    });

    it('should return 404 when schedule does not exist', async () => {
      const mockStorage = {
        getSchedule: jest.fn().mockResolvedValue(null)
      };

      require('../../../storage').getStorage = jest.fn().mockResolvedValue(mockStorage);

      const response = await request(app)
        .post('/api/schedules/999/bol')
        .attach('file', Buffer.from('fake pdf content'), 'test.pdf')
        .expect(404);

      expect(response.body.error).toBe('Schedule not found');
    });
  });

  describe('GET /api/schedules/:id/bol', () => {
    it('should list BOL documents for a schedule', async () => {
      const mockBolDocs = [
        { id: 1, fileName: 'bol1.pdf', fileKey: 'key1', uploadedBy: 1, createdAt: new Date() },
        { id: 2, fileName: 'bol2.pdf', fileKey: 'key2', uploadedBy: 1, createdAt: new Date() }
      ];

      const mockStorage = {
        getSchedule: jest.fn().mockResolvedValue({ id: 1, facilityId: 1 }),
        getBolDocumentsByScheduleId: jest.fn().mockResolvedValue(mockBolDocs),
        getUser: jest.fn().mockResolvedValue({ firstName: 'John', lastName: 'Doe' })
      };

      const mockBlobService = {
        getSignedUrl: jest.fn().mockResolvedValue('https://signed-url.com/file')
      };

      require('../../../storage').getStorage = jest.fn().mockResolvedValue(mockStorage);
      require('../../../services/blob-storage').blobStorageService = mockBlobService;

      const response = await request(app)
        .get('/api/schedules/1/bol')
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toMatchObject({
        id: 1,
        fileName: 'bol1.pdf',
        url: 'https://signed-url.com/file',
        uploadedBy: 'John Doe'
      });

      expect(mockStorage.getSchedule).toHaveBeenCalledWith(1);
      expect(mockStorage.getBolDocumentsByScheduleId).toHaveBeenCalledWith(1);
    });

    it('should return empty array when no BOL documents exist', async () => {
      const mockStorage = {
        getSchedule: jest.fn().mockResolvedValue({ id: 1, facilityId: 1 }),
        getBolDocumentsByScheduleId: jest.fn().mockResolvedValue([])
      };

      require('../../../storage').getStorage = jest.fn().mockResolvedValue(mockStorage);

      const response = await request(app)
        .get('/api/schedules/1/bol')
        .expect(200);

      expect(response.body).toEqual([]);
    });
  });

  describe('DELETE /api/bol/:bolId', () => {
    it('should delete BOL document when user is admin', async () => {
      const mockBolDoc = {
        id: 1,
        fileKey: 'file-key-123',
        uploadedBy: 2 // Different user, but current user is admin
      };

      const mockStorage = {
        getBolDocumentById: jest.fn().mockResolvedValue(mockBolDoc),
        deleteBolDocument: jest.fn().mockResolvedValue(true)
      };

      const mockBlobService = {
        deleteFile: jest.fn().mockResolvedValue(true)
      };

      require('../../../storage').getStorage = jest.fn().mockResolvedValue(mockStorage);
      require('../../../services/blob-storage').blobStorageService = mockBlobService;

      const response = await request(app)
        .delete('/api/bol/1')
        .expect(204);

      expect(mockStorage.getBolDocumentById).toHaveBeenCalledWith(1);
      expect(mockBlobService.deleteFile).toHaveBeenCalledWith('file-key-123', 1);
      expect(mockStorage.deleteBolDocument).toHaveBeenCalledWith(1);
    });

    it('should delete BOL document when user owns it', async () => {
      const mockBolDoc = {
        id: 1,
        fileKey: 'file-key-123',
        uploadedBy: 1 // Same as current user
      };

      const mockStorage = {
        getBolDocumentById: jest.fn().mockResolvedValue(mockBolDoc),
        deleteBolDocument: jest.fn().mockResolvedValue(true)
      };

      const mockBlobService = {
        deleteFile: jest.fn().mockResolvedValue(true)
      };

      require('../../../storage').getStorage = jest.fn().mockResolvedValue(mockStorage);
      require('../../../services/blob-storage').blobStorageService = mockBlobService;

      // Override user role to non-admin
      const app2 = express();
      app2.use(express.json());
      app2.use((req: any, res, next) => {
        req.user = { id: 1, tenantId: 1, role: 'staff' };
        next();
      });
      app2.delete('/api/bol/:bolId', deleteBol);

      const response = await request(app2)
        .delete('/api/bol/1')
        .expect(204);

      expect(mockStorage.getBolDocumentById).toHaveBeenCalledWith(1);
      expect(mockStorage.deleteBolDocument).toHaveBeenCalledWith(1);
    });

    it('should return 403 when user cannot delete BOL document', async () => {
      const mockBolDoc = {
        id: 1,
        fileKey: 'file-key-123',
        uploadedBy: 2 // Different user
      };

      const mockStorage = {
        getBolDocumentById: jest.fn().mockResolvedValue(mockBolDoc)
      };

      require('../../../storage').getStorage = jest.fn().mockResolvedValue(mockStorage);

      // Override user role to non-admin
      const app3 = express();
      app3.use(express.json());
      app3.use((req: any, res, next) => {
        req.user = { id: 1, tenantId: 1, role: 'staff' };
        next();
      });
      app3.delete('/api/bol/:bolId', deleteBol);

      const response = await request(app3)
        .delete('/api/bol/1')
        .expect(403);

      expect(response.body.error).toBe('You do not have permission to delete this BOL document');
    });

    it('should return 404 when BOL document does not exist', async () => {
      const mockStorage = {
        getBolDocumentById: jest.fn().mockResolvedValue(null)
      };

      require('../../../storage').getStorage = jest.fn().mockResolvedValue(mockStorage);

      const response = await request(app)
        .delete('/api/bol/999')
        .expect(404);

      expect(response.body.error).toBe('BOL document not found');
    });
  });
}); 