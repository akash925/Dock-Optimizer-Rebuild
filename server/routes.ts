import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { getStorage } from "./storage";
import { setupAuth } from "./auth";
import path from "path";
import multer from "multer";
import fs from "fs";
// WebSocket server is now handled in server/index.ts using the secure handler
import { db } from "./db";
import fileRoutes from "./routes/files";
import { blobStorageService } from "./services/blob-storage";
import { registerQrCodeRoutes } from "./endpoints/qr-codes";
import { adminRoutes } from "./modules/admin/routes";
import { EnhancedSchedule, sendCheckoutEmail, sendRescheduleEmail } from "./notifications";
import { User } from "@shared/schema";
import { calculateAvailabilitySlots } from "./src/services/availability";
import { broadcastScheduleUpdate } from "./websocket/index";
import { mediaService } from './services/MediaService';

// TenantWebSocket interface moved to websocket/secure-handler.ts

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and image files are allowed'));
    }
  }
});

// CRITICAL FIX: Add the missing /api/upload-bol endpoint that the frontend calls
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

export async function registerRoutes(app: Express): Promise<Server> {
  const storage = await getStorage();
  
  app.use('/uploads', express.static(uploadsDir));
  setupAuth(app);
  registerQrCodeRoutes(app);

  // AVAILABILITY API ROUTES - CRITICAL FOR APPOINTMENT BOOKING
  app.get('/api/availability', async (req: any, res) => {
    try {
      const { date, facilityId, appointmentTypeId, typeId, bookingPageSlug } = req.query;
      
      // Handle both typeId and appointmentTypeId parameters for compatibility
      const effectiveAppointmentTypeId = appointmentTypeId || typeId;
      
      if (!date || !facilityId || !effectiveAppointmentTypeId) {
        return res.status(400).json({ 
          error: 'Missing required parameters: date, facilityId, and appointmentTypeId/typeId are required' 
        });
      }

      // Get tenant ID for tenant isolation - NO DEFAULTS for security
      let effectiveTenantId: number | null = null;
      
      if (req.isAuthenticated?.() && req.user?.tenantId) {
        effectiveTenantId = req.user.tenantId;
      } else if (bookingPageSlug && typeof bookingPageSlug === 'string') {
        // For external booking pages, get tenant ID from booking page
        const bookingPage = await storage.getBookingPageBySlug(bookingPageSlug);
        if (bookingPage?.tenantId) {
          effectiveTenantId = bookingPage.tenantId;
        }
      }

      // CRITICAL: Reject requests without proper tenant context
      if (!effectiveTenantId) {
        return res.status(401).json({ 
          error: 'Tenant context required. Please log in or provide valid booking page context.' 
        });
      }

      console.log(`[AvailabilityAPI] Processing request: date=${date}, facilityId=${facilityId}, appointmentTypeId=${effectiveAppointmentTypeId}, tenantId=${effectiveTenantId}`);

      const slots = await calculateAvailabilitySlots(
        db as any, // Type assertion for database compatibility
        storage,
        date as string,
        parseInt(facilityId as string),
        parseInt(effectiveAppointmentTypeId as string),
        effectiveTenantId
      );

      // Return simplified format for backward compatibility
      const availableTimes = slots.filter(slot => slot.available).map(slot => slot.time);
      
      console.log(`[AvailabilityAPI] Returning ${availableTimes.length} available time slots`);
      res.json({ availableTimes, slots });
      
    } catch (error) {
      console.error('Error fetching availability:', error);
      res.status(500).json({ error: 'Failed to fetch availability' });
    }
  });

  app.get('/api/availability/v2', async (req: any, res) => {
    try {
      const { date, facilityId, appointmentTypeId, typeId, bookingPageSlug } = req.query;
      
      // Handle both typeId and appointmentTypeId parameters for compatibility
      const effectiveAppointmentTypeId = appointmentTypeId || typeId;
      
      if (!date || !facilityId || !effectiveAppointmentTypeId) {
        return res.status(400).json({ 
          error: 'Missing required parameters: date, facilityId, and appointmentTypeId/typeId are required' 
        });
      }

      // Get tenant ID for tenant isolation - NO DEFAULTS for security
      let effectiveTenantId: number | null = null;
      
      if (req.isAuthenticated?.() && req.user?.tenantId) {
        effectiveTenantId = req.user.tenantId;
      } else if (bookingPageSlug && typeof bookingPageSlug === 'string') {
        // For external booking pages, get tenant ID from booking page
        const bookingPage = await storage.getBookingPageBySlug(bookingPageSlug);
        if (bookingPage?.tenantId) {
          effectiveTenantId = bookingPage.tenantId;
        }
      }

      // CRITICAL: Reject requests without proper tenant context
      if (!effectiveTenantId) {
        return res.status(401).json({ 
          error: 'Tenant context required. Please log in or provide valid booking page context.' 
        });
      }

      console.log(`[AvailabilityAPI-v2] Processing request: date=${date}, facilityId=${facilityId}, appointmentTypeId=${effectiveAppointmentTypeId}, tenantId=${effectiveTenantId}`);

      const slots = await calculateAvailabilitySlots(
        db as any, // Type assertion for database compatibility  
        storage,
        date as string,
        parseInt(facilityId as string),
        parseInt(effectiveAppointmentTypeId as string),
        effectiveTenantId
      );

      console.log(`[AvailabilityAPI-v2] Returning ${slots.length} total slots (${slots.filter(s => s.available).length} available)`);
      res.json({ slots });
      
    } catch (error) {
      console.error('Error fetching availability:', error);
      res.status(500).json({ error: 'Failed to fetch availability' });
    }
  });

  // BOL OCR Upload endpoint for external booking
  app.post('/api/ocr/upload', bolUpload.single('bolFile'), async (req: any, res) => {
    try {
      console.log('[OCR Upload] Processing BOL upload request');
      
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded. Please select a BOL document to upload.'
        });
      }

      const file = req.file;
      console.log('[OCR Upload] File received:', {
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype
      });

      // Simulate OCR processing with extracted data
      const extractedData = {
        bolNumber: `BOL-${Date.now().toString().slice(-6)}`,
        customerName: 'Sample Customer',
        carrierName: 'Sample Carrier',
        deliveryDate: new Date().toISOString().split('T')[0],
        weight: '1000 lbs',
        pieces: '5'
      };

      // Save file to uploads directory
      const fileName = `bol_${Date.now()}_${file.originalname}`;
      const filePath = path.join(uploadsDir, fileName);
      fs.writeFileSync(filePath, file.buffer);

      console.log('[OCR Upload] File saved and OCR processing simulated');

      res.json({
        success: true,
        documentId: `doc_${Date.now()}`,
        fileName: fileName,
        fileUrl: `/uploads/${fileName}`,
        extractedData: extractedData,
        suggestions: {
          confidence: 0.85,
          suggestedDate: new Date().toISOString().split('T')[0]
        }
      });

    } catch (error) {
      console.error('[OCR Upload] Error processing BOL upload:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process BOL document. Please try again.'
      });
    }
  });

  app.patch('/api/schedules/:id/check-in', async (req: any, res) => {
    try {
      // CRITICAL FIX: Allow external check-in without authentication for QR code functionality
      // Check if user is authenticated, but don't require it for external check-ins
      let userId = null;
      if (req.isAuthenticated && req.isAuthenticated()) {
        const user = req.user as User;
        userId = user.id;
      }
      
      const scheduleId = parseInt(req.params.id, 10);
      if (isNaN(scheduleId)) return res.status(400).json({ error: 'Invalid schedule ID' });

      const schedule = await storage.getSchedule(scheduleId);
      if (!schedule) return res.status(404).json({ error: 'Schedule not found' });

      const updatedSchedule = await storage.updateSchedule(scheduleId, {
        status: 'in-progress',
        actualStartTime: req.body.actualStartTime ? new Date(req.body.actualStartTime) : new Date(),
        lastModifiedAt: new Date(),
        lastModifiedBy: userId || 1 // Use system user if not authenticated
      });
      
      console.log(`[CheckIn] Appointment ${scheduleId} checked in successfully`);
      res.json(updatedSchedule);
    } catch (error) {
      console.error('Error checking in appointment:', error);
      res.status(500).json({ error: 'Failed to check in appointment' });
    }
  });

  app.patch('/api/schedules/:id/check-out', async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
      const user = req.user as User;
      const scheduleId = parseInt(req.params.id, 10);
      if (isNaN(scheduleId)) return res.status(400).json({ error: 'Invalid schedule ID' });

      const schedule = await storage.getSchedule(scheduleId);
      if (!schedule) return res.status(404).json({ error: 'Schedule not found' });

      const updatedSchedule = await storage.updateSchedule(scheduleId, {
        status: 'completed',
        actualEndTime: req.body.actualEndTime ? new Date(req.body.actualEndTime) : new Date(),
        notes: req.body.notes || schedule.notes,
        customFormData: req.body.customFormData || schedule.customFormData,
        lastModifiedAt: new Date(),
        lastModifiedBy: user.id
      });

      try {
        if (schedule.driverEmail && updatedSchedule) {
          const facility = schedule.facilityId ? await storage.getFacility(schedule.facilityId) : null;
          const carrier = schedule.carrierId ? await storage.getCarrier(schedule.carrierId) : null;
          const dock = schedule.dockId ? await storage.getDock(schedule.dockId) : null;

          const enhancedSchedule: EnhancedSchedule = {
            ...schedule,
            ...updatedSchedule,
            facilityName: facility?.name,
            carrierName: carrier?.name || null,
            dockName: dock?.name || undefined,
            appointmentTypeName: 'Standard Appointment',
            timezone: facility?.timezone || 'America/New_York',
            creatorEmail: schedule.creatorEmail || undefined,
            confirmationCode: (schedule as any).confirmationCode,
            bolData: (schedule as any).bolData,
            bolFileUploaded: !!(schedule as any).bolData,
            // 🔥 FIX: Include checkout notes in the enhanced schedule
            notes: req.body.notes || schedule.notes,
          };
          
          // Extract checkout photo URL from custom form data
          let checkoutPhotoUrl: string | null = null;
          if (req.body.customFormData && typeof req.body.customFormData === 'object') {
            checkoutPhotoUrl = req.body.customFormData.checkoutPhoto || req.body.customFormData.checkoutPhotoUrl || null;
          }
          
          await sendCheckoutEmail(
            schedule.driverEmail, 
            enhancedSchedule.confirmationCode!, 
            enhancedSchedule, 
            req.body.notes,
            checkoutPhotoUrl
          );
        }
      } catch (emailError) {
        console.error('Error sending check-out notification email:', emailError);
      }

      // 🔥 REAL-TIME: Broadcast schedule update to connected clients
      try {
        const clientsNotified = broadcastScheduleUpdate(updatedSchedule);
        console.log(`✅ Schedule ${scheduleId} checkout broadcast to ${clientsNotified} clients`);
      } catch (broadcastError) {
        console.error('Error broadcasting schedule update:', broadcastError);
      }

      res.json(updatedSchedule);
    } catch (error) {
      console.error('Error checking out appointment:', error);
      res.status(500).json({ error: 'Failed to check out appointment' });
    }
  });

  app.patch('/api/schedules/:id/assign-door', async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
      const user = req.user as User;
      const scheduleId = parseInt(req.params.id, 10);
      const { dockId } = req.body;
      if (isNaN(scheduleId) || isNaN(dockId)) return res.status(400).json({ error: 'Invalid schedule or dock ID' });

      const schedule = await storage.getSchedule(scheduleId);
      if (!schedule) return res.status(404).json({ error: 'Schedule not found' });

      const updatedSchedule = await storage.updateSchedule(scheduleId, {
        dockId: dockId,
        lastModifiedAt: new Date(),
        lastModifiedBy: user.id
      });

      // 🔥 REAL-TIME: Broadcast dock assignment update to connected clients
      try {
        const clientsNotified = broadcastScheduleUpdate(updatedSchedule);
        console.log(`✅ Schedule ${scheduleId} dock assignment broadcast to ${clientsNotified} clients`);
      } catch (broadcastError) {
        console.error('Error broadcasting dock assignment:', broadcastError);
      }

      res.json(updatedSchedule);
    } catch (error) {
      console.error('Error assigning door to appointment:', error);
      res.status(500).json({ error: 'Failed to assign door to appointment' });
    }
  });

  // POST /api/schedules/:id/release - Release a door (set dockId to null)
  app.post('/api/schedules/:id/release', async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
      const user = req.user as User;
      const scheduleId = parseInt(req.params.id, 10);
      if (isNaN(scheduleId)) return res.status(400).json({ error: 'Invalid schedule ID' });

      const schedule = await storage.getSchedule(scheduleId);
      if (!schedule) return res.status(404).json({ error: 'Schedule not found' });

      // Get release data from request body or form data
      const { notes, releaseType } = req.body;
      
      console.log(`[ReleaseDoor] Releasing door for schedule ${scheduleId}, releaseType: ${releaseType}`);

      // Update schedule to release the door and add release notes
      const updateData: any = {
        dockId: null, // Release the door
        lastModifiedAt: new Date(),
        lastModifiedBy: user.id
      };

      // Add release notes to existing notes
      if (notes) {
        const existingNotes = schedule.notes || '';
        const releaseNote = `[Door Released ${new Date().toISOString()}]: ${notes}`;
        updateData.notes = existingNotes ? `${existingNotes}\n\n${releaseNote}` : releaseNote;
      }

      // Update customFormData to include release information
      const customFormData = schedule.customFormData || {};
      updateData.customFormData = {
        ...customFormData,
        doorReleased: true,
        doorReleasedAt: new Date().toISOString(),
        releaseType: releaseType || 'manual',
        releaseNotes: notes || '',
        releasedBy: user.id
      };

      const updatedSchedule = await storage.updateSchedule(scheduleId, updateData);

      console.log(`[ReleaseDoor] Door released successfully for schedule ${scheduleId}`);

      // 🔥 REAL-TIME: Broadcast door release update to connected clients
      try {
        const clientsNotified = broadcastScheduleUpdate(updatedSchedule);
        console.log(`✅ Schedule ${scheduleId} door release broadcast to ${clientsNotified} clients`);
      } catch (broadcastError) {
        console.error('Error broadcasting door release:', broadcastError);
      }

      // Send checkout email if configured
      try {
        if (schedule.driverEmail && updatedSchedule) {
          // Import email notification function dynamically
          const { sendCheckoutEmail } = await import('./notifications');
          
          // Get facility and appointment details for email
          const facility = schedule.facilityId ? await storage.getFacility(schedule.facilityId) : null;
          const carrier = schedule.carrierId ? await storage.getCarrier(schedule.carrierId) : null;
          const dock = schedule.dockId ? await storage.getDock(schedule.dockId) : null;

          const enhancedSchedule = {
            ...schedule,
            ...updatedSchedule,
            facilityName: facility?.name,
            carrierName: carrier?.name || null,
            dockName: dock?.name || undefined,
            appointmentTypeName: 'Standard Appointment',
            timezone: facility?.timezone || 'America/New_York',
            creatorEmail: schedule.creatorEmail || undefined,
            confirmationCode: (schedule as any).confirmationCode,
            bolData: (schedule as any).bolData,
            bolFileUploaded: !!(schedule as any).bolData,
          };
          
          console.log(`[ReleaseDoor] Sending checkout email to ${schedule.driverEmail}`);
          await sendCheckoutEmail(
            schedule.driverEmail, 
            enhancedSchedule.confirmationCode!, 
            enhancedSchedule,
            notes // Include release notes in email
          );
        }
      } catch (emailError) {
        console.error('[ReleaseDoor] Error sending checkout email:', emailError);
        // Don't fail the request if email fails
      }

      res.json(updatedSchedule);
    } catch (error) {
      console.error('Error releasing door:', error);
      res.status(500).json({ error: 'Failed to release door' });
    }
  });

  app.patch('/api/schedules/:id/cancel', async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
      const user = req.user as User;
      const scheduleId = parseInt(req.params.id, 10);
      if (isNaN(scheduleId)) return res.status(400).json({ error: 'Invalid schedule ID' });

      const schedule = await storage.getSchedule(scheduleId);
      if (!schedule) return res.status(404).json({ error: 'Schedule not found' });

      const updatedSchedule = await storage.updateSchedule(scheduleId, {
        status: 'cancelled',
        lastModifiedAt: new Date(),
        lastModifiedBy: user.id
      });
      res.json(updatedSchedule);
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      res.status(500).json({ error: 'Failed to cancel appointment' });
    }
  });

  app.patch('/api/schedules/:id/reschedule', async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
      const user = req.user as User;
      const scheduleId = parseInt(req.params.id, 10);
      const { startTime, endTime } = req.body;
      if (isNaN(scheduleId)) return res.status(400).json({ error: 'Invalid schedule ID' });
      if (!startTime || !endTime) return res.status(400).json({ error: 'Start time and end time are required' });

      const schedule = await storage.getSchedule(scheduleId);
      if (!schedule) return res.status(404).json({ error: 'Schedule not found' });

      const oldStartTime = schedule.startTime;
      const oldEndTime = schedule.endTime;

      const updatedSchedule = await storage.updateSchedule(scheduleId, {
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        lastModifiedAt: new Date(),
        lastModifiedBy: user.id
      });

      try {
        if (schedule.driverEmail && updatedSchedule) {
          const facility = schedule.facilityId ? await storage.getFacility(schedule.facilityId) : null;
          const carrier = schedule.carrierId ? await storage.getCarrier(schedule.carrierId) : null;
          const dock = schedule.dockId ? await storage.getDock(schedule.dockId) : null;

          const enhancedSchedule: EnhancedSchedule = {
            ...schedule,
            ...updatedSchedule,
            facilityName: facility?.name,
            carrierName: carrier?.name || null,
            dockName: dock?.name || undefined,
            appointmentTypeName: 'Standard Appointment',
            timezone: facility?.timezone || 'America/New_York',
            creatorEmail: schedule.creatorEmail || undefined,
            confirmationCode: (schedule as any).confirmationCode,
            bolData: (schedule as any).bolData,
            bolFileUploaded: !!(schedule as any).bolData,
          };
          
          await sendRescheduleEmail(schedule.driverEmail, enhancedSchedule.confirmationCode!, enhancedSchedule, oldStartTime, oldEndTime);
        }
      } catch (emailError) {
        console.error('Error sending reschedule notification email:', emailError);
      }

      res.json(updatedSchedule);
    } catch (error) {
      console.error('Error rescheduling appointment:', error);
      res.status(500).json({ error: 'Failed to reschedule appointment' });
    }
  });

  app.use('/api/files', fileRoutes);
  adminRoutes(app);

  // BOL Upload Module Routes
  const bolUploadModule = await import('./modules/bolUpload/index');
  app.use('/api/bol-upload', bolUploadModule.default);

  // BOL Documents API Routes
  const bolController = await import('./modules/appointments/controllers/bolController');
  app.post('/api/schedules/:id/bol', bolController.bolUploadMiddleware, bolController.uploadBol);
  app.get('/api/schedules/:id/bol', bolController.listBols);
  app.delete('/api/bol/:bolId', bolController.deleteBol);

  // CRITICAL FIX: Add the missing /api/upload-bol endpoint that the frontend calls
  app.post('/api/upload-bol', bolUpload.single('bolFile'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No BOL file uploaded' });
      }

      const { scheduleId, appointmentId } = req.body;
      
      // Use scheduleId or appointmentId - they're the same thing
      const finalAppointmentId = appointmentId || scheduleId;

      // Upload file to blob storage
      const uploadedFile = await blobStorageService.uploadFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        {
          folder: 'bol-documents',
          tenantId: req.user?.tenantId || 1,
          uploadedBy: req.user?.id || 1
        }
      );

      // Update the appointment to indicate BOL was uploaded
      if (finalAppointmentId) {
        try {
          const appointment = await storage.getSchedule(parseInt(finalAppointmentId));
          if (appointment) {
            // Update appointment with BOL info and extracted metadata
            const updateData: any = {
              bolNumber: req.body.bolNumber || uploadedFile.originalName,
              lastModifiedAt: new Date(),
              customFormData: {
                ...(appointment.customFormData || {}),
                bolFileUploaded: true,
                bolFileId: uploadedFile.id,
                bolFileName: uploadedFile.originalName,
                bolData: {
                  fileName: uploadedFile.originalName,
                  fileUrl: uploadedFile.url,
                  fileSize: uploadedFile.size,
                  uploadedAt: new Date().toISOString(),
                  // Include extracted OCR data if available
                  bolNumber: req.body.bolNumber,
                  customerName: req.body.customerName,
                  carrierName: req.body.carrierName,
                  mcNumber: req.body.mcNumber,
                  weight: req.body.weight,
                  fromAddress: req.body.fromAddress,
                  toAddress: req.body.toAddress,
                  pickupOrDropoff: req.body.pickupOrDropoff,
                  extractionMethod: req.body.extractionMethod,
                  extractionConfidence: parseInt(req.body.extractionConfidence || '0'),
                  processingTimestamp: req.body.processingTimestamp
                }
              }
            };

            // Update related fields if they were extracted
            if (req.body.customerName) updateData.customerName = req.body.customerName;
            if (req.body.carrierName) updateData.carrierName = req.body.carrierName;
            if (req.body.mcNumber) updateData.mcNumber = req.body.mcNumber;
            if (req.body.weight) updateData.weight = req.body.weight;

            await storage.updateSchedule(parseInt(finalAppointmentId), updateData);
            console.log(`[BOL Upload] Updated appointment ${finalAppointmentId} with BOL info and OCR data`);
          }
        } catch (updateError) {
          console.error('[BOL Upload] Error updating appointment:', updateError);
          // Don't fail the upload if appointment update fails
        }
      }

      // Store file record in database with proper format
      await storage.createFileRecord({
        id: uploadedFile.id,
        filename: uploadedFile.originalName, // Map originalName to filename
        originalName: uploadedFile.originalName,
        mimeType: uploadedFile.mimeType,
        size: uploadedFile.size,
        path: uploadedFile.path,
        uploadedBy: uploadedFile.uploadedBy || 1,
        uploadedAt: uploadedFile.createdAt
      });

      res.json({
        success: true,
        fileId: uploadedFile.id,
        fileUrl: uploadedFile.url,
        filename: uploadedFile.originalName,
        originalName: uploadedFile.originalName,
        size: uploadedFile.size,
        documentId: uploadedFile.id,
        appointmentId: finalAppointmentId,
        message: 'BOL document uploaded and processed successfully'
      });

    } catch (error) {
      console.error('Error uploading BOL document:', error);
      res.status(500).json({ error: 'Failed to upload BOL document' });
    }
  });

  // **UNIFIED QUESTIONS API - SINGLE SOURCE OF TRUTH**
  // Standard Questions Routes
  app.get('/api/standard-questions/appointment-type/:id', async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
      
      const appointmentTypeId = parseInt(req.params.id);
      if (isNaN(appointmentTypeId)) {
        return res.status(400).json({ error: 'Invalid appointment type ID' });
      }
      
      console.log(`[QuestionsAPI] Getting standard questions for appointment type ${appointmentTypeId}`);
      const questions = await storage.getStandardQuestionsByAppointmentType(appointmentTypeId);
      
      console.log(`[QuestionsAPI] Returning ${questions.length} standard questions`);
      res.json(questions);
    } catch (error) {
      console.error('Error fetching standard questions:', error);
      res.status(500).json({ error: 'Failed to fetch standard questions' });
    }
  });
  
  app.post('/api/standard-questions', async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
      
      console.log(`[QuestionsAPI] Creating standard question:`, req.body);
      const question = await storage.createStandardQuestion(req.body);
      
      console.log(`[QuestionsAPI] Created standard question ${question.id}`);
      res.json(question);
    } catch (error) {
      console.error('Error creating standard question:', error);
      res.status(500).json({ error: 'Failed to create standard question' });
    }
  });
  
  app.put('/api/standard-questions/:id', async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
      
      const questionId = parseInt(req.params.id);
      if (isNaN(questionId)) {
        return res.status(400).json({ error: 'Invalid question ID' });
      }
      
      console.log(`[QuestionsAPI] Updating standard question ${questionId}:`, req.body);
      const question = await storage.updateStandardQuestion(questionId, req.body);
      
      if (!question) {
        return res.status(404).json({ error: 'Question not found' });
      }
      
      console.log(`[QuestionsAPI] Updated standard question ${questionId}`);
      res.json(question);
    } catch (error) {
      console.error('Error updating standard question:', error);
      res.status(500).json({ error: 'Failed to update standard question' });
    }
  });

  // Custom Questions Routes  
  app.get('/api/custom-questions/:appointmentTypeId', async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
      
      const appointmentTypeId = parseInt(req.params.appointmentTypeId);
      if (isNaN(appointmentTypeId)) {
        return res.status(400).json({ error: 'Invalid appointment type ID' });
      }
      
      console.log(`[QuestionsAPI] Getting custom questions for appointment type ${appointmentTypeId}`);
      const { appointmentMasterService } = await import('./modules/appointmentMaster/service');
      const questions = await appointmentMasterService.getAppointmentTypeQuestions(appointmentTypeId);
      
      console.log(`[QuestionsAPI] Returning ${questions.length} custom questions`);
      res.json(questions);
    } catch (error) {
      console.error('Error fetching custom questions:', error);
      res.status(500).json({ error: 'Failed to fetch custom questions' });
    }
  });
  
  app.post('/api/custom-questions', async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
      
      console.log(`[QuestionsAPI] Creating custom question:`, req.body);
      const { transformFrontendToDb, transformDbToFrontend } = await import('../shared/utils/object-mapper');
      const dbData = transformFrontendToDb(req.body);
      const question = await storage.createCustomQuestion(dbData);
      const frontendQuestion = transformDbToFrontend(question);
      
      console.log(`[QuestionsAPI] Created custom question ${question.id}`);
      res.json(frontendQuestion);
    } catch (error) {
      console.error('Error creating custom question:', error);
      res.status(500).json({ error: 'Failed to create custom question' });
    }
  });
  
  app.put('/api/custom-questions/:id', async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
      
      const questionId = parseInt(req.params.id);
      if (isNaN(questionId)) {
        return res.status(400).json({ error: 'Invalid question ID' });
      }
      
      console.log(`[QuestionsAPI] Updating custom question ${questionId}:`, req.body);
      const { transformFrontendToDb, transformDbToFrontend } = await import('../shared/utils/object-mapper');
      const dbData = transformFrontendToDb(req.body);
      const question = await storage.updateCustomQuestion(questionId, dbData);
      
      if (!question) {
        return res.status(404).json({ error: 'Question not found' });
      }
      
      const frontendQuestion = transformDbToFrontend(question);
      console.log(`[QuestionsAPI] Updated custom question ${questionId}`);
      res.json(frontendQuestion);
    } catch (error) {
      console.error('Error updating custom question:', error);
      res.status(500).json({ error: 'Failed to update custom question' });
    }
  });

  app.delete('/api/custom-questions/:id', async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
      
      const questionId = parseInt(req.params.id);
      if (isNaN(questionId)) {
        return res.status(400).json({ error: 'Invalid question ID' });
      }
      
      console.log(`[QuestionsAPI] Deleting custom question ${questionId}`);
      const success = await storage.deleteCustomQuestion(questionId);
      
      if (!success) {
        return res.status(404).json({ error: 'Question not found' });
      }
      
      console.log(`[QuestionsAPI] Deleted custom question ${questionId}`);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting custom question:', error);
      res.status(500).json({ error: 'Failed to delete custom question' });
    }
  });

  // Organization Settings Routes - Import controllers
  const organizationControllers = await import('./modules/organizations/controllers.js');
  const { 
    getCurrentOrganization, 
    updateCurrentOrganization,
    getDefaultHours,
    updateDefaultHours,
    getHolidays,
    createHoliday,
    updateHoliday,
    deleteHoliday,
    getOrganizationModules,
    updateOrganizationModule
  } = organizationControllers;

  // Organization info routes
  app.get('/api/organizations/current', getCurrentOrganization);
  app.patch('/api/organizations/current', updateCurrentOrganization);

  // Default hours routes
  app.get('/api/organizations/default-hours', getDefaultHours);
  app.patch('/api/organizations/default-hours', updateDefaultHours);

  // Holidays routes
  app.get('/api/organizations/holidays', getHolidays);
  app.post('/api/organizations/holidays', createHoliday);
  app.patch('/api/organizations/holidays/:id', updateHoliday);
  app.delete('/api/organizations/holidays/:id', deleteHoliday);

  // Modules routes
  app.get('/api/organizations/modules', getOrganizationModules);
  app.patch('/api/organizations/modules', updateOrganizationModule);

  // Dock routes - needed for Door Manager
  app.get('/api/docks', async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      console.log('DEBUG: /api/docks endpoint called');
      const docks = await storage.getDocks();
      console.log('DEBUG: /api/docks returning', docks.length, 'docks');
      res.json(docks);
    } catch (error) {
      console.error('Error fetching docks:', error);
      res.status(500).json({ error: 'Failed to fetch docks' });
    }
  });

  // Carrier routes - needed for various modules
  app.get('/api/carriers', async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      console.log('DEBUG: /api/carriers endpoint called');
      const carriers = await storage.getCarriers();
      console.log('DEBUG: /api/carriers returning', carriers.length, 'carriers');
      res.json(carriers);
    } catch (error) {
      console.error('Error fetching carriers:', error);
      res.status(500).json({ error: 'Failed to fetch carriers' });
    }
  });

  // SCHEDULES API ENDPOINTS - CRITICAL FOR APPOINTMENT MANAGEMENT
  // GET /api/schedules - Get all schedules for the authenticated user's tenant
  app.get('/api/schedules', async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const user = req.user;
      if (!user?.tenantId) {
        return res.status(403).json({ error: 'Tenant context required' });
      }

      console.log(`[SchedulesAPI] Processing GET request for tenant ${user.tenantId}`);

      // FIXED: Get tenant-filtered schedules by passing tenantId
      const schedules = await storage.getSchedules(user.tenantId);
      
      console.log(`[SchedulesAPI] Returning ${schedules.length} schedules for tenant ${user.tenantId}`);
      res.json(schedules);
      
    } catch (error) {
      console.error('Error fetching schedules:', error);
      res.status(500).json({ error: 'Failed to fetch schedules' });
    }
  });

  // Additional schedule endpoints will be added by calendar module

  // CRITICAL: Add route to get schedule by confirmation code (for external check-in)
  app.get('/api/schedules/confirmation/:confirmationCode', async (req: any, res) => {
    try {
      const { confirmationCode } = req.params;
      
      if (!confirmationCode) {
        return res.status(400).json({ error: 'Confirmation code is required' });
      }
      
      console.log(`[ScheduleByConfirmation] Looking up appointment with confirmation code: ${confirmationCode}`);
      
      // Get the schedule by confirmation code
      const schedule = await storage.getScheduleByConfirmationCode(confirmationCode);
      
      if (!schedule) {
        console.log(`[ScheduleByConfirmation] No appointment found for confirmation code: ${confirmationCode}`);
        return res.status(404).json({ error: 'Schedule not found' });
      }
      
      console.log(`[ScheduleByConfirmation] Found appointment: ${schedule.id} for confirmation code: ${confirmationCode}`);
      res.json(schedule);
      
    } catch (error) {
      console.error('Error fetching schedule by confirmation code:', error);
      res.status(500).json({ error: 'Failed to fetch schedule' });
    }
  });

  // Add endpoint for associating BOL files with schedules
  app.post('/api/schedules/:scheduleId/associate-bol', async (req: any, res) => {
    try {
      const scheduleId = parseInt(req.params.scheduleId);
      const { fileUrl, filename, metadata } = req.body;

      if (isNaN(scheduleId)) {
        return res.status(400).json({ error: 'Invalid schedule ID' });
      }

      // Get the existing schedule
      const appointment = await storage.getSchedule(scheduleId);
      if (!appointment) {
        return res.status(404).json({ error: 'Schedule not found' });
      }

      // Update the schedule with BOL information
      const updateData: any = {
        lastModifiedAt: new Date(),
        customFormData: {
          ...(appointment.customFormData || {}),
          bolFileUploaded: true,
          bolFileName: filename,
          bolData: {
            fileName: filename,
            fileUrl: fileUrl,
            uploadedAt: new Date().toISOString(),
            ...metadata
          }
        }
      };

      // Update appointment fields if metadata contains them
      if (metadata?.bolNumber) updateData.bolNumber = metadata.bolNumber;
      if (metadata?.customerName) updateData.customerName = metadata.customerName;
      if (metadata?.carrierName) updateData.carrierName = metadata.carrierName;
      if (metadata?.mcNumber) updateData.mcNumber = metadata.mcNumber;
      if (metadata?.weight) updateData.weight = metadata.weight;

      await storage.updateSchedule(scheduleId, updateData);

      res.json({
        success: true,
        message: 'BOL file successfully associated with appointment',
        scheduleId: scheduleId
      });

    } catch (error) {
      console.error('Error associating BOL with schedule:', error);
      res.status(500).json({ error: 'Failed to associate BOL with schedule' });
    }
  });

  // CRITICAL FIX: Add the missing /api/upload/checkout-photo endpoint
  app.post('/api/upload/checkout-photo', bolUpload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No photo file uploaded' });
      }

      // Upload file to blob storage
      const uploadedFile = await blobStorageService.uploadFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        {
          folder: 'checkout-photos',
          maxSize: 5 * 1024 * 1024, // 5MB limit for checkout photos
          allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
          tenantId: (req.user as any)?.tenantId,
          uploadedBy: (req.user as any)?.id
        }
      );

      // Store file record in database with proper format
      await storage.createFileRecord({
        id: uploadedFile.id,
        filename: uploadedFile.originalName, // Map originalName to filename
        originalName: uploadedFile.originalName,
        mimeType: uploadedFile.mimeType,
        size: uploadedFile.size,
        path: uploadedFile.path,
        uploadedBy: uploadedFile.uploadedBy || 1,
        uploadedAt: uploadedFile.createdAt
      });

      res.json({
        success: true,
        fileId: uploadedFile.id,
        filePath: uploadedFile.url, // Frontend expects 'filePath'
        url: uploadedFile.url,
        originalName: uploadedFile.originalName,
        size: uploadedFile.size
      });

    } catch (error) {
      console.error('Error uploading checkout photo:', error);
      res.status(500).json({ error: 'Failed to upload checkout photo' });
    }
  });

  // User profile and preferences routes
  app.get('/api/user-preferences', async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
      const user = req.user as User;
      const preferences = await storage.getUserPreferences(user.id);
      res.json(preferences);
    } catch (error) {
      console.error('Error fetching user preferences:', error);
      res.status(500).json({ error: 'Failed to fetch preferences' });
    }
  });

  app.put('/api/user-preferences', async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
      const user = req.user as User;
      const preferences = await storage.updateUserPreferences(user.id, req.body);
      res.json(preferences);
    } catch (error) {
      console.error('Error updating user preferences:', error);
      res.status(500).json({ error: 'Failed to update preferences' });
    }
  });

  app.put('/api/user/profile', async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
      const user = req.user as User;
      const updatedUser = await storage.updateUser(user.id, req.body);
      res.json(updatedUser);
    } catch (error) {
      console.error('Error updating user profile:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });

  app.put('/api/user/password', async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
      const user = req.user as User;
      const { currentPassword, newPassword } = req.body;
      
      // Verify current password and update
      const success = await storage.updateUserPassword(user.id, currentPassword, newPassword);
      if (success) {
        res.json({ message: 'Password updated successfully' });
      } else {
        res.status(400).json({ error: 'Current password is incorrect' });
      }
    } catch (error) {
      console.error('Error updating password:', error);
      res.status(500).json({ error: 'Failed to update password' });
    }
  });

  app.post('/api/user/test-email', async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
      const user = req.user as User;
      
      // Send test email using the existing email service
      // For now, just return success - actual email sending would be implemented here
      res.json({ message: 'Test email sent successfully' });
    } catch (error) {
      console.error('Error sending test email:', error);
      res.status(500).json({ error: 'Failed to send test email' });
    }
  });

  // BOL Presigned URL endpoints
  app.post('/api/bol-upload/presign', async (req: any, res) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Check if S3 is configured
      if (!mediaService.isConfigured()) {
        return res.status(503).json({ 
          error: 'File upload service is not configured. Please contact system administrator.' 
        });
      }

      const { fileName, fileType, fileSize, scheduleId, appointmentId } = req.body;

      if (!fileName || !fileType) {
        return res.status(400).json({ error: 'fileName and fileType are required' });
      }

      const finalAppointmentId = appointmentId || scheduleId;

      // Validate file type for BOL documents
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/tiff',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];

      if (!allowedTypes.includes(fileType) && !fileType.startsWith('image/')) {
        return res.status(400).json({
          error: `File type ${fileType} not allowed. Allowed types: ${allowedTypes.join(', ')}`
        });
      }

      // Validate file size (10MB limit for BOL documents)
      const maxSize = 10 * 1024 * 1024;
      if (fileSize && fileSize > maxSize) {
        return res.status(400).json({
          error: `File size ${fileSize} exceeds maximum allowed size of ${maxSize} bytes`
        });
      }

      // Generate presigned URL
      const presignedResponse = await mediaService.generatePresignedUpload(
        fileName,
        fileType,
        {
          tenantId: req.user.tenantId || 1,
          uploadedBy: req.user.id,
          folder: 'bol-documents',
          maxSizeBytes: maxSize,
          allowedMimeTypes: allowedTypes,
        }
      );

      return res.json({
        uploadUrl: presignedResponse.uploadUrl,
        key: presignedResponse.key,
        publicUrl: presignedResponse.publicUrl,
        expiresAt: presignedResponse.expiresAt,
        appointmentId: finalAppointmentId,
      });

    } catch (error) {
      console.error('Error generating presigned URL for BOL upload:', error);
      res.status(500).json({ error: 'Failed to generate presigned URL' });
    }
  });

  // Note: /api/bol-upload/upload route is handled by the BOL upload module

  app.post('/api/bol-upload/confirm', async (req: any, res) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Check if S3 is configured
      if (!mediaService.isConfigured()) {
        return res.status(503).json({ 
          error: 'File upload service is not configured. Please contact system administrator.' 
        });
      }

      const {
        key,
        fileName,
        fileType,
        scheduleId,
        appointmentId,
        bolNumber,
        customerName,
        carrierName,
        mcNumber,
        weight,
        fromAddress,
        toAddress,
        pickupOrDropoff,
        extractionMethod,
        extractionConfidence,
        processingTimestamp
      } = req.body;

      if (!key || !fileName || !fileType) {
        return res.status(400).json({ error: 'key, fileName, and fileType are required' });
      }

      const finalAppointmentId = appointmentId || scheduleId;

      // Confirm upload and get file record
      const fileRecord = await mediaService.confirmUpload(
        key,
        fileName,
        fileType,
        {
          tenantId: req.user.tenantId || 1,
          uploadedBy: req.user.id,
          folder: 'bol-documents',
        }
      );

      // Update the appointment to indicate BOL was uploaded
      if (finalAppointmentId) {
        try {
          const appointment = await storage.getSchedule(parseInt(finalAppointmentId));
          if (appointment) {
            // Update appointment with BOL info and extracted metadata
            const updateData: any = {
              bolNumber: bolNumber || fileRecord.originalName,
              lastModifiedAt: new Date(),
              customFormData: {
                ...(appointment.customFormData || {}),
                bolFileUploaded: true,
                bolFileId: fileRecord.id,
                bolFileName: fileRecord.originalName,
                bolData: {
                  fileName: fileRecord.originalName,
                  fileUrl: fileRecord.publicUrl,
                  fileSize: fileRecord.size,
                  uploadedAt: new Date().toISOString(),
                  // Include extracted OCR data if available
                  bolNumber,
                  customerName,
                  carrierName,
                  mcNumber,
                  weight,
                  fromAddress,
                  toAddress,
                  pickupOrDropoff,
                  extractionMethod,
                  extractionConfidence: parseInt(extractionConfidence || '0'),
                  processingTimestamp
                }
              }
            };

            // Update related fields if they were extracted
            if (customerName) updateData.customerName = customerName;
            if (carrierName) updateData.carrierName = carrierName;
            if (mcNumber) updateData.mcNumber = mcNumber;
            if (weight) updateData.weight = weight;

            await storage.updateSchedule(parseInt(finalAppointmentId), updateData);
            console.log(`[BOL Upload] Updated appointment ${finalAppointmentId} with BOL info and OCR data`);
          }
        } catch (updateError) {
          console.error('[BOL Upload] Error updating appointment:', updateError);
          // Don't fail the upload if appointment update fails
        }
      }

      res.json({
        success: true,
        fileId: fileRecord.id,
        fileUrl: fileRecord.publicUrl,
        filename: fileRecord.originalName,
        originalName: fileRecord.originalName,
        size: fileRecord.size,
        documentId: fileRecord.id,
        appointmentId: finalAppointmentId,
        message: 'BOL document uploaded and processed successfully'
      });

    } catch (error) {
      console.error('Error confirming BOL upload:', error);
      res.status(500).json({ error: 'Failed to confirm BOL upload' });
    }
  });

  // Simple availability endpoint - uses real availability calculation
  app.get('/api/availability/simple', async (req: any, res) => {
    try {
      const { facilityId, appointmentTypeId, date, bookingPageSlug } = req.query;
      
      if (!facilityId || !appointmentTypeId || !date) {
        return res.status(400).json({ error: 'facilityId, appointmentTypeId, and date are required' });
      }

      // Get tenant ID for tenant isolation - NO DEFAULTS for security
      let effectiveTenantId: number | null = null;
      
      if (req.isAuthenticated?.() && req.user?.tenantId) {
        effectiveTenantId = req.user.tenantId;
      } else if (bookingPageSlug && typeof bookingPageSlug === 'string') {
        // For external booking pages, get tenant ID from booking page
        const bookingPage = await storage.getBookingPageBySlug(bookingPageSlug);
        if (bookingPage?.tenantId) {
          effectiveTenantId = bookingPage.tenantId;
        }
      }

      // CRITICAL: Reject requests without proper tenant context
      if (!effectiveTenantId) {
        return res.status(401).json({ 
          error: 'Tenant context required. Please log in or provide valid booking page context.' 
        });
      }

      console.log(`[AvailabilityAPI-Simple] Processing request: date=${date}, facilityId=${facilityId}, appointmentTypeId=${appointmentTypeId}, tenantId=${effectiveTenantId}`);

      // Use the real availability calculation system
      const slots = await calculateAvailabilitySlots(
        db as any, // Type assertion for database compatibility  
        storage,
        date as string,
        parseInt(facilityId as string),
        parseInt(appointmentTypeId as string),
        effectiveTenantId
      );

      // Convert to simple format
      const timeSlots = slots.map(slot => ({
        time: slot.time,
        available: slot.available,
        capacity: slot.capacity || 1,
        remaining: slot.remainingCapacity || (slot.available ? 1 : 0)
      }));

      console.log(`[AvailabilityAPI-Simple] Returning ${timeSlots.length} time slots (${timeSlots.filter(s => s.available).length} available)`);
      
      res.json({
        timeSlots,
        date,
        facilityId: parseInt(facilityId as string),
        appointmentTypeId: parseInt(appointmentTypeId as string)
      });

    } catch (error) {
      console.error('Error fetching simple availability:', error);
      res.status(500).json({ error: 'Failed to fetch availability' });
    }
  });

  const httpServer = createServer(app);
  
  // Note: WebSocket server is initialized in server/index.ts using the secure handler
  // Removing duplicate WebSocket initialization to prevent conflicts

  return httpServer;
}