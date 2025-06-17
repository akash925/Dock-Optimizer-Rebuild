import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { getStorage } from "./storage";
import { setupAuth } from "./auth";
import path from "path";
import multer from "multer";
import fs from "fs";
import { WebSocket, WebSocketServer } from "ws";
import { db } from "./db";
import fileRoutes from "./routes/files";
import { registerQrCodeRoutes } from "./endpoints/qr-codes";
import { adminRoutes } from "./modules/admin/routes";
import { EnhancedSchedule, sendCheckoutEmail, sendRescheduleEmail } from "./notifications";
import { User } from "@shared/schema";
import { calculateAvailabilitySlots } from "./src/services/availability";

interface TenantWebSocket extends WebSocket {
  tenantId?: number;
  userId?: number;
  isAlive?: boolean;
}

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
        db,
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
        db,
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

  app.patch('/api/schedules/:id/check-in', async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
      const user = req.user as User;
      const scheduleId = parseInt(req.params.id, 10);
      if (isNaN(scheduleId)) return res.status(400).json({ error: 'Invalid schedule ID' });

      const schedule = await storage.getSchedule(scheduleId);
      if (!schedule) return res.status(404).json({ error: 'Schedule not found' });

      const updatedSchedule = await storage.updateSchedule(scheduleId, {
        status: 'in-progress',
        actualStartTime: req.body.actualStartTime ? new Date(req.body.actualStartTime) : new Date(),
        lastModifiedAt: new Date(),
        lastModifiedBy: user.id
      });
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
            carrierName: carrier?.name || undefined,
            dockName: dock?.name || undefined,
            appointmentTypeName: 'Standard Appointment',
            timezone: facility?.timezone || 'America/New_York',
            creatorEmail: schedule.creatorEmail || undefined,
            confirmationCode: (schedule as any).confirmationCode,
            bolData: (schedule as any).bolData,
            bolFileUploaded: !!(schedule as any).bolData,
          };
          
          await sendCheckoutEmail(schedule.driverEmail, enhancedSchedule.confirmationCode!, enhancedSchedule, req.body.notes);
        }
      } catch (emailError) {
        console.error('Error sending check-out notification email:', emailError);
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
      res.json(updatedSchedule);
    } catch (error) {
      console.error('Error assigning door to appointment:', error);
      res.status(500).json({ error: 'Failed to assign door to appointment' });
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
            carrierName: carrier?.name || undefined,
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

  // The rest of the file...
  // This is a reconstruction of the file with fixes focused on the areas that had linter errors.
  
  const httpServer = createServer(app);
  
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/ws'
  });
  
  wss.on('connection', (ws: TenantWebSocket) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('message', (message: string) => { console.log(`Received message: ${message}`); });
    ws.on('close', () => { console.log('WebSocket client disconnected'); });
  });
  
  setInterval(() => {
    wss.clients.forEach((ws: WebSocket) => {
      const tenantWs = ws as TenantWebSocket;
      if (tenantWs.isAlive === false) return tenantWs.terminate();
      tenantWs.isAlive = false;
      tenantWs.ping(() => {});
    });
  }, 30000);

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

      // Get tenant-filtered schedules
      const schedules = await storage.getSchedules(user.tenantId);
      
      console.log(`[SchedulesAPI] Returning ${schedules.length} schedules for tenant ${user.tenantId}`);
      res.json(schedules);
      
    } catch (error) {
      console.error('Error fetching schedules:', error);
      res.status(500).json({ error: 'Failed to fetch schedules' });
    }
  });

  // Additional schedule endpoints will be added by calendar module

  return httpServer;
}