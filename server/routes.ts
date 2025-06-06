import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { getStorage } from "./storage";
import { setupAuth } from "./auth";
import path from "path";
import multer from "multer";
import fs from "fs";
import { WebSocketServer } from "ws";
import { db } from "./db";
import fileRoutes from "./routes/files";
import { registerQrCodeRoutes } from "./endpoints/qr-codes";
import { adminRoutes } from "./modules/admin/routes";

// Type for the WebSocket client with tenant metadata
interface TenantWebSocket extends WebSocket {
  tenantId?: number;
  userId?: number;
  isAlive?: boolean;
}

// Configure multer for file uploads
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({
  dest: uploadsDir,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept PDF and image files
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and image files are allowed'));
    }
  }
});

/**
 * Register routes for the application
 */
export async function registerRoutes(app: Express): Promise<Server> {
  // Get storage instance
  const storage = await getStorage();
  
  // Serve static files from uploads directory for photos and documents
  app.use('/uploads', express.static(uploadsDir));
  
  // Setup authentication routes
  setupAuth(app);
  
  // Register QR code routes for email functionality
  registerQrCodeRoutes(app);

  // Check-in appointment endpoint
  app.patch('/api/schedules/:id/check-in', async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const scheduleId = parseInt(req.params.id);
      const { actualStartTime } = req.body;
      
      if (isNaN(scheduleId)) {
        return res.status(400).json({ error: 'Invalid schedule ID' });
      }

      const schedule = await storage.getSchedule(scheduleId);
      
      if (!schedule) {
        return res.status(404).json({ error: 'Schedule not found' });
      }

      // Update schedule with check-in information
      const updatedSchedule = await storage.updateSchedule(scheduleId, {
        status: 'in-progress',
        actualStartTime: actualStartTime ? new Date(actualStartTime) : new Date(),
        lastModifiedAt: new Date(),
        lastModifiedBy: req.user.id
      });

      res.json(updatedSchedule);
    } catch (error) {
      console.error('Error checking in appointment:', error);
      res.status(500).json({ error: 'Failed to check in appointment' });
    }
  });

  // Check-out appointment endpoint
  app.patch('/api/schedules/:id/check-out', async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const scheduleId = parseInt(req.params.id);
      const { actualEndTime, notes, customFormData } = req.body;
      
      if (isNaN(scheduleId)) {
        return res.status(400).json({ error: 'Invalid schedule ID' });
      }

      const schedule = await storage.getSchedule(scheduleId);
      
      if (!schedule) {
        return res.status(404).json({ error: 'Schedule not found' });
      }

      // Update schedule with check-out information
      const updatedSchedule = await storage.updateSchedule(scheduleId, {
        status: 'completed',
        actualEndTime: actualEndTime ? new Date(actualEndTime) : new Date(),
        notes: notes || schedule.notes,
        customFormData: customFormData || schedule.customFormData,
        lastModifiedAt: new Date(),
        lastModifiedBy: req.user.id
      });

      res.json(updatedSchedule);
    } catch (error) {
      console.error('Error checking out appointment:', error);
      res.status(500).json({ error: 'Failed to check out appointment' });
    }
  });

  // Assign door to appointment endpoint
  app.patch('/api/schedules/:id/assign-door', async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const scheduleId = parseInt(req.params.id);
      const { dockId } = req.body;
      
      if (isNaN(scheduleId) || isNaN(dockId)) {
        return res.status(400).json({ error: 'Invalid schedule or dock ID' });
      }

      const schedule = await storage.getSchedule(scheduleId);
      
      if (!schedule) {
        return res.status(404).json({ error: 'Schedule not found' });
      }

      // Update schedule with dock assignment
      const updatedSchedule = await storage.updateSchedule(scheduleId, {
        dockId: dockId,
        lastModifiedAt: new Date(),
        lastModifiedBy: req.user.id
      });

      res.json(updatedSchedule);
    } catch (error) {
      console.error('Error assigning door to appointment:', error);
      res.status(500).json({ error: 'Failed to assign door to appointment' });
    }
  });

  // Cancel appointment endpoint
  app.patch('/api/schedules/:id/cancel', async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const scheduleId = parseInt(req.params.id);
      
      if (isNaN(scheduleId)) {
        return res.status(400).json({ error: 'Invalid schedule ID' });
      }

      const schedule = await storage.getSchedule(scheduleId);
      
      if (!schedule) {
        return res.status(404).json({ error: 'Schedule not found' });
      }

      // Update schedule status to cancelled
      const updatedSchedule = await storage.updateSchedule(scheduleId, {
        status: 'cancelled',
        lastModifiedAt: new Date(),
        lastModifiedBy: req.user.id
      });

      res.json(updatedSchedule);
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      res.status(500).json({ error: 'Failed to cancel appointment' });
    }
  });

  // Reschedule appointment endpoint
  app.patch('/api/schedules/:id/reschedule', async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const scheduleId = parseInt(req.params.id);
      const { startTime, endTime } = req.body;
      
      if (isNaN(scheduleId)) {
        return res.status(400).json({ error: 'Invalid schedule ID' });
      }

      if (!startTime || !endTime) {
        return res.status(400).json({ error: 'Start time and end time are required' });
      }

      const schedule = await storage.getSchedule(scheduleId);
      
      if (!schedule) {
        return res.status(404).json({ error: 'Schedule not found' });
      }

      // Update schedule with new times
      const updatedSchedule = await storage.updateSchedule(scheduleId, {
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        lastModifiedAt: new Date(),
        lastModifiedBy: req.user.id
      });

      res.json(updatedSchedule);
    } catch (error) {
      console.error('Error rescheduling appointment:', error);
      res.status(500).json({ error: 'Failed to reschedule appointment' });
    }
  });
  
  // File upload and serving routes
  app.use('/api/files', fileRoutes);
  
  // Register admin routes
  adminRoutes(app);
  
  // BOL document access endpoint
  app.get('/api/schedules/:id/documents', async (req: any, res) => {
    try {
      const scheduleId = parseInt(req.params.id);
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      // Get schedule to verify tenant access
      const schedule = await storage.getSchedule(scheduleId);
      if (!schedule) {
        return res.status(404).json({ error: 'Schedule not found' });
      }

      // Get facility to check tenant ownership
      const facility = await storage.getFacility(schedule.facilityId);
      if (!facility || facility.tenantId !== user.tenantId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Find documents associated with this schedule
      const documentsDir = path.join(process.cwd(), 'uploads', 'bol');
      const documents = [];
      
      if (fs.existsSync(documentsDir)) {
        const files = fs.readdirSync(documentsDir);
        for (const file of files) {
          if (file.includes(`schedule_${scheduleId}_`) || file.includes(`appointment_${scheduleId}_`)) {
            const filePath = path.join(documentsDir, file);
            const stats = fs.statSync(filePath);
            documents.push({
              filename: file,
              uploadDate: stats.mtime,
              size: stats.size,
              downloadUrl: `/api/schedules/${scheduleId}/documents/${file}`
            });
          }
        }
      }

      res.json({ documents });
    } catch (error) {
      console.error('Error fetching documents:', error);
      res.status(500).json({ error: 'Failed to fetch documents' });
    }
  });

  // BOL document download endpoint
  app.get('/api/schedules/:id/documents/:filename', async (req: any, res) => {
    try {
      const scheduleId = parseInt(req.params.id);
      const filename = req.params.filename;
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      // Verify tenant access
      const schedule = await storage.getSchedule(scheduleId);
      if (!schedule) {
        return res.status(404).json({ error: 'Schedule not found' });
      }

      const facility = await storage.getFacility(schedule.facilityId);
      if (!facility || facility.tenantId !== user.tenantId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Serve the file
      const filePath = path.join(process.cwd(), 'uploads', 'bol', filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Document not found' });
      }

      res.download(filePath);
    } catch (error) {
      console.error('Error downloading document:', error);
      res.status(500).json({ error: 'Failed to download document' });
    }
  });
  
  // Core API routes that frontend expects
  app.get('/api/users', async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const currentUser = req.user;
      const users = await storage.getUsers();
      
      // Filter users by tenant ID for proper tenant isolation
      const tenantUsers = users.filter(user => user.tenantId === currentUser.tenantId);
      
      // Remove password field for security
      const safeUsers = tenantUsers.map(({ password, ...user }) => user);
      res.json(safeUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });
  
  // Appointment types endpoint
  app.get('/api/appointment-types', async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const currentUser = req.user;
      const appointmentTypes = await storage.getAppointmentTypes();
      
      // Filter appointment types by tenant ID for proper tenant isolation
      const tenantAppointmentTypes = appointmentTypes.filter(type => type.tenantId === currentUser.tenantId);
      
      res.json(tenantAppointmentTypes);
    } catch (error) {
      console.error('Error fetching appointment types:', error);
      res.status(500).json({ error: 'Failed to fetch appointment types' });
    }
  });
  
  // Booking pages endpoint
  app.get('/api/booking-pages', async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const currentUser = req.user;
      const bookingPages = await storage.getBookingPages();
      
      // Filter booking pages by tenant ID for proper tenant isolation
      const tenantBookingPages = bookingPages.filter(page => page.tenantId === currentUser.tenantId);
      
      res.json(tenantBookingPages);
    } catch (error) {
      console.error('Error fetching booking pages:', error);
      res.status(500).json({ error: 'Failed to fetch booking pages' });
    }
  });
  
  // Docks endpoint
  app.get('/api/docks', async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const currentUser = req.user;
      const docks = await storage.getDocks();
      
      // Filter docks by tenant ID through facility association
      const facilities = await storage.getFacilities();
      const tenantFacilities = facilities.filter(facility => facility.tenantId === currentUser.tenantId);
      const tenantFacilityIds = tenantFacilities.map(facility => facility.id);
      
      const tenantDocks = docks.filter(dock => tenantFacilityIds.includes(dock.facilityId));
      
      res.json(tenantDocks);
    } catch (error) {
      console.error('Error fetching docks:', error);
      res.status(500).json({ error: 'Failed to fetch docks' });
    }
  });

  // Create dock endpoint
  app.post('/api/docks', async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const currentUser = req.user;
      const { facilityId, ...dockData } = req.body;
      
      // Verify facility belongs to tenant
      const facilities = await storage.getFacilities();
      const facility = facilities.find(f => f.id === facilityId && f.tenantId === currentUser.tenantId);
      
      if (!facility) {
        return res.status(403).json({ error: 'Access denied to this facility' });
      }
      
      const dock = await storage.createDock({ ...dockData, facilityId });
      res.status(201).json(dock);
    } catch (error) {
      console.error('Error creating dock:', error);
      res.status(500).json({ error: 'Failed to create dock' });
    }
  });

  // Update dock endpoint
  app.put('/api/docks/:id', async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const currentUser = req.user;
      const dockId = parseInt(req.params.id);
      
      // Get existing dock to verify ownership
      const existingDock = await storage.getDock(dockId);
      if (!existingDock) {
        return res.status(404).json({ error: 'Dock not found' });
      }
      
      // Verify facility belongs to tenant
      const facilities = await storage.getFacilities();
      const facility = facilities.find(f => f.id === existingDock.facilityId && f.tenantId === currentUser.tenantId);
      
      if (!facility) {
        return res.status(403).json({ error: 'Access denied to this dock' });
      }
      
      const dock = await storage.updateDock(dockId, req.body);
      res.json(dock);
    } catch (error) {
      console.error('Error updating dock:', error);
      res.status(500).json({ error: 'Failed to update dock' });
    }
  });

  // Delete dock endpoint
  app.delete('/api/docks/:id', async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const currentUser = req.user;
      const dockId = parseInt(req.params.id);
      
      // Get existing dock to verify ownership
      const existingDock = await storage.getDock(dockId);
      if (!existingDock) {
        return res.status(404).json({ error: 'Dock not found' });
      }
      
      // Verify facility belongs to tenant
      const facilities = await storage.getFacilities();
      const facility = facilities.find(f => f.id === existingDock.facilityId && f.tenantId === currentUser.tenantId);
      
      if (!facility) {
        return res.status(403).json({ error: 'Access denied to this dock' });
      }
      
      await storage.deleteDock(dockId);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting dock:', error);
      res.status(500).json({ error: 'Failed to delete dock' });
    }
  });

  // Create user with invitation email
  app.post('/api/users', async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const { email, firstName, lastName, role = 'worker' } = req.body;
      
      if (!email || !firstName || !lastName) {
        return res.status(400).json({ error: 'Email, firstName, and lastName are required' });
      }
      
      // Generate temporary password
      const tempPassword = Math.random().toString(36).slice(-8);
      
      // Create user with proper tenant ID
      const currentUser = req.user;
      const newUser = await storage.createUser({
        username: email,
        email,
        firstName,
        lastName,
        role,
        password: tempPassword, // This will be hashed in storage
        tenantId: currentUser.tenantId // Assign to same tenant as creator
      });
      
      // Send invitation email if SendGrid is configured
      if (process.env.SENDGRID_API_KEY) {
        try {
          const { sendUserInvitationEmail } = require('./services/email');
          const currentUser = req.user;
          const inviterName = `${currentUser.firstName} ${currentUser.lastName}`;
          const organizationName = 'Dock Optimizer'; // Could be dynamic based on tenant
          
          await sendUserInvitationEmail(email, tempPassword, organizationName, inviterName);
          console.log(`Invitation email sent to ${email}`);
        } catch (emailError) {
          console.error('Failed to send invitation email:', emailError);
          // Don't fail the user creation if email fails
        }
      }
      
      // Remove password from response
      const { password, ...safeUser } = newUser;
      res.status(201).json(safeUser);
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({ error: 'Failed to create user' });
    }
  });
  
  // Get appointment type fields for dynamic columns
  app.get('/api/appointment-type-fields', async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const currentUser = req.user;
      const appointmentTypeFields = await storage.getAppointmentTypeFields(currentUser.tenantId);
      
      // Filter by tenant through appointment types
      const appointmentTypes = await storage.getAppointmentTypes();
      const tenantAppointmentTypeIds = appointmentTypes
        .filter(type => type.tenantId === currentUser.tenantId)
        .map(type => type.id);
      
      const tenantFields = appointmentTypeFields.filter(field => 
        tenantAppointmentTypeIds.includes(field.appointmentTypeId)
      );
      
      res.json(tenantFields);
    } catch (error) {
      console.error('Error fetching appointment type fields:', error);
      res.status(500).json({ error: 'Failed to fetch appointment type fields' });
    }
  });

  // Sample data creation endpoint for testing analytics
  app.post('/api/sample-data', async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const currentUser = req.user;
      if (currentUser.role !== 'admin' && currentUser.role !== 'super-admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }
      
      // Get facilities for this tenant
      const facilities = await storage.getFacilities();
      const tenantFacilities = facilities.filter(facility => facility.tenantId === currentUser.tenantId);
      
      if (tenantFacilities.length === 0) {
        return res.status(400).json({ error: 'No facilities found for tenant' });
      }
      
      // Get appointment types for this tenant
      const appointmentTypes = await storage.getAppointmentTypes();
      const tenantAppointmentTypes = appointmentTypes.filter(type => type.tenantId === currentUser.tenantId);
      
      if (tenantAppointmentTypes.length === 0) {
        return res.status(400).json({ error: 'No appointment types found for tenant' });
      }
      
      // Create sample appointments for the last 7 days
      const sampleAppointments = [];
      const now = new Date();
      
      for (let i = 0; i < 7; i++) {
        const appointmentDate = new Date(now);
        appointmentDate.setDate(appointmentDate.getDate() - i);
        appointmentDate.setHours(9 + (i % 8), 0, 0, 0); // Vary the hours
        
        const facility = tenantFacilities[i % tenantFacilities.length];
        const appointmentType = tenantAppointmentTypes[i % tenantAppointmentTypes.length];
        
        const endTime = new Date(appointmentDate);
        endTime.setHours(endTime.getHours() + 2); // 2-hour appointments
        
        const appointment = {
          type: i % 2 === 0 ? 'inbound' : 'outbound',
          status: ['scheduled', 'in-progress', 'completed'][i % 3],
          startTime: appointmentDate,
          endTime: endTime,
          appointmentTypeId: appointmentType.id,
          customFormData: {
            facilityInfo: {
              id: facility.id,
              name: facility.name
            },
            customerInfo: {
              name: `Sample Customer ${i + 1}`,
              email: `customer${i + 1}@example.com`
            },
            carrierInfo: {
              name: `Sample Carrier ${i + 1}`,
              contact: `carrier${i + 1}@example.com`
            }
          }
        };
        
        try {
          const createdAppointment = await storage.createSchedule(appointment);
          sampleAppointments.push(createdAppointment);
        } catch (error) {
          console.error('Error creating sample appointment:', error);
        }
      }
      
      res.json({ 
        message: `Created ${sampleAppointments.length} sample appointments`,
        appointments: sampleAppointments
      });
    } catch (error) {
      console.error('Error creating sample data:', error);
      res.status(500).json({ error: 'Failed to create sample data' });
    }
  });

  // Schedule confirmation lookup endpoint
  app.get('/api/schedules/confirmation/:code', async (req: any, res) => {
    try {
      const { code } = req.params;
      
      if (!code) {
        return res.status(400).json({ error: 'Confirmation code is required' });
      }
      
      console.log(`[API] Looking up schedule with confirmation code: ${code}`);
      
      const schedule = await storage.getScheduleByConfirmationCode(code);
      
      if (!schedule) {
        return res.status(404).json({ error: 'Schedule not found' });
      }
      
      console.log(`[API] Found schedule with ID: ${schedule.id}`);
      
      // Get additional details for complete response
      let facility = null;
      let appointmentType = null;
      
      // Get facility information if facilityId exists
      if (schedule.facilityId) {
        facility = await storage.getFacility(schedule.facilityId);
      }
      
      // Get appointment type information
      if (schedule.appointmentTypeId) {
        appointmentType = await storage.getAppointmentType(schedule.appointmentTypeId);
      }
      
      // Build complete response with facility and appointment type details
      const response = {
        schedule,
        facility: facility ? {
          id: facility.id,
          name: facility.name,
          address1: facility.address1,
          address2: facility.address2,
          city: facility.city,
          state: facility.state,
          pincode: facility.pincode,
          country: facility.country,
          timezone: facility.timezone
        } : null,
        facilityName: facility?.name,
        facilityAddress: facility ? `${facility.address1}, ${facility.city}, ${facility.state} ${facility.pincode}` : null,
        appointmentType: appointmentType ? {
          id: appointmentType.id,
          name: appointmentType.name,
          duration: appointmentType.duration,
          type: appointmentType.type
        } : null,
        appointmentTypeName: appointmentType?.name,
        timezone: facility?.timezone || 'America/New_York'
      };
      
      res.json(response);
    } catch (error) {
      console.error('Error fetching schedule by confirmation code:', error);
      res.status(500).json({ error: 'Failed to fetch schedule' });
    }
  });

  // Availability API endpoints
  app.get('/api/availability/v2', async (req: any, res) => {
    try {
      const { date, facilityId, appointmentTypeId, bookingPageSlug } = req.query;
      
      if (!date || !facilityId || !appointmentTypeId) {
        return res.status(400).json({ 
          error: 'Missing required parameters: date, facilityId, appointmentTypeId' 
        });
      }
      
      // Import the availability service
      const { calculateAvailabilitySlots } = await import('./src/services/availability');
      
      // Get tenant context from booking page if available
      let effectiveTenantId = null;
      if (bookingPageSlug) {
        try {
          const bookingPage = await storage.getBookingPageBySlug(bookingPageSlug);
          if (bookingPage) {
            effectiveTenantId = bookingPage.tenantId;
          }
        } catch (error) {
          console.warn('Could not get tenant from booking page:', error);
        }
      }
      
      // If no tenant from booking page and user is authenticated, use user's tenant
      if (!effectiveTenantId && req.isAuthenticated()) {
        effectiveTenantId = req.user.tenantId;
      }
      
      // Calculate availability slots
      const slots = await calculateAvailabilitySlots(
        db,
        storage,
        date,
        parseInt(facilityId),
        parseInt(appointmentTypeId),
        effectiveTenantId
      );
      
      // Return slots in expected format
      res.json({
        slots: slots,
        availableTimes: slots.filter(slot => slot.available).map(slot => slot.time),
        date: date,
        facilityId: parseInt(facilityId),
        appointmentTypeId: parseInt(appointmentTypeId)
      });
    } catch (error) {
      console.error('Error calculating availability:', error);
      res.status(500).json({ 
        error: 'Failed to calculate availability',
        message: error.message 
      });
    }
  });
  
  // Legacy availability endpoint for backward compatibility
  app.get('/api/availability', async (req: any, res) => {
    try {
      const { date, facilityId, appointmentTypeId, bookingPageSlug } = req.query;
      
      if (!date || !facilityId || !appointmentTypeId) {
        return res.status(400).json({ 
          error: 'Missing required parameters: date, facilityId, appointmentTypeId' 
        });
      }
      
      // Import the availability service
      const { calculateAvailabilitySlots } = await import('./src/services/availability');
      
      // Get tenant context from booking page if available
      let effectiveTenantId = null;
      if (bookingPageSlug) {
        try {
          const bookingPage = await storage.getBookingPageBySlug(bookingPageSlug);
          if (bookingPage) {
            effectiveTenantId = bookingPage.tenantId;
          }
        } catch (error) {
          console.warn('Could not get tenant from booking page:', error);
        }
      }
      
      // If no tenant from booking page and user is authenticated, use user's tenant
      if (!effectiveTenantId && req.isAuthenticated()) {
        effectiveTenantId = req.user.tenantId;
      }
      
      // Calculate availability slots
      const slots = await calculateAvailabilitySlots(
        db,
        storage,
        date,
        parseInt(facilityId),
        parseInt(appointmentTypeId),
        effectiveTenantId
      );
      
      // Return in legacy format
      res.json(slots);
    } catch (error) {
      console.error('Error calculating availability:', error);
      res.status(500).json({ 
        error: 'Failed to calculate availability',
        message: error.message 
      });
    }
  });

  // External booking submission endpoint
  app.post('/api/booking-pages/book/:slug', async (req: any, res) => {
    try {
      const { slug } = req.params;
      const bookingData = req.body;
      
      // Get booking page to determine tenant context
      const bookingPage = await storage.getBookingPageBySlug(slug);
      if (!bookingPage) {
        return res.status(404).json({ error: 'Booking page not found' });
      }
      
      // Get facility information to handle timezone correctly
      const facility = await storage.getFacility(bookingData.facilityId);
      const facilityTimezone = facility?.timezone || 'America/New_York';
      
      // Get appointment type for duration and validation
      const appointmentType = await storage.getAppointmentType(bookingData.appointmentTypeId);
      if (!appointmentType) {
        return res.status(400).json({ error: 'Invalid appointment type' });
      }
      
      // Parse the selected time correctly without timezone conversion issues
      const utcStartTime = new Date(`${bookingData.date}T${bookingData.time}:00.000Z`);
      
      // Duration is stored in minutes, calculate end time correctly
      const durationMinutes = appointmentType.duration || 60;
      const utcEndTime = new Date(utcStartTime.getTime() + (durationMinutes * 60 * 1000));
      
      // 🔥 CRITICAL VALIDATION: Check availability before creating appointment
      console.log(`[Booking Validation] Checking availability for ${bookingData.date} ${bookingData.time} at facility ${bookingData.facilityId}`);
      
      try {
        // Import availability service
        const { calculateAvailabilitySlots } = await import('./src/services/availability');
        
        // Calculate available slots for the requested date
        const availableSlots = await calculateAvailabilitySlots(
          db,
          storage,
          bookingData.date,
          bookingData.facilityId,
          bookingData.appointmentTypeId,
          bookingPage.tenantId
        );
        
        // Find the specific time slot that was requested
        const requestedSlot = availableSlots.find(slot => slot.time === bookingData.time);
        
        if (!requestedSlot) {
          console.log(`[Booking Validation] ❌ Time slot ${bookingData.time} not found in available slots`);
          return res.status(400).json({ 
            error: 'Invalid time slot selected',
            message: 'The selected time slot is not available for booking'
          });
        }
        
        if (!requestedSlot.available) {
          console.log(`[Booking Validation] ❌ Time slot ${bookingData.time} is not available: ${requestedSlot.reason}`);
          return res.status(409).json({ 
            error: 'Time slot not available',
            message: requestedSlot.reason || 'The selected time slot is no longer available'
          });
        }
        
        if (requestedSlot.remainingCapacity <= 0) {
          console.log(`[Booking Validation] ❌ Time slot ${bookingData.time} has no remaining capacity`);
          return res.status(409).json({ 
            error: 'Slot fully booked',
            message: 'This time slot is fully booked. Please select another time.'
          });
        }
        
        console.log(`[Booking Validation] ✅ Time slot ${bookingData.time} is available with ${requestedSlot.remainingCapacity} remaining capacity`);
        
      } catch (availabilityError) {
        console.error('[Booking Validation] Error checking availability:', availabilityError);
        return res.status(500).json({ 
          error: 'Unable to verify availability',
          message: 'Please try again or contact support'
        });
      }
      
      // Create the appointment
      const appointmentData = {
        type: bookingData.pickupOrDropoff || 'pickup',
        status: 'scheduled',
        startTime: utcStartTime,
        endTime: utcEndTime,
        facilityId: bookingData.facilityId, // Explicitly set facility ID
        appointmentTypeId: bookingData.appointmentTypeId,
        customFormData: {
          customerInfo: {
            name: bookingData.customerName,
            email: bookingData.email
          },
          facilityInfo: {
            facilityId: bookingData.facilityId,
            facilityName: facility?.name
          }
        },
        createdBy: 1, // System user for external bookings
        truckNumber: bookingData.truckNumber || 'TBD'
      };
      
      const appointment = await storage.createSchedule(appointmentData);
      
      // Generate tenant-specific confirmation code
      // Get facility's tenant information using the organization_facilities mapping
      const facilityTenantId = await storage.getFacilityTenantId(bookingData.facilityId);
      const organization = await storage.getTenantById(facilityTenantId);
      
      // Generate tenant-specific confirmation code prefix
      let prefix = 'DOC'; // Default fallback
      if (organization && organization.name) {
        const name = organization.name.toLowerCase();
        console.log(`Organization name for confirmation code: ${organization.name}`);
        
        if (name.includes('hanzo')) {
          prefix = 'HZL';
        } else if (name.includes('fresh connect') || name.includes('fresh')) {
          prefix = 'FCH';
        } else {
          // Extract initials from organization name
          const words = organization.name.split(' ');
          if (words.length >= 2) {
            prefix = words.map(word => word.charAt(0).toUpperCase()).join('').substring(0, 3);
          } else if (words[0].length >= 3) {
            prefix = words[0].substring(0, 3).toUpperCase();
          }
        }
      }
      
      console.log(`Generated confirmation code prefix: ${prefix} for organization: ${organization?.name}`);
      
      const confirmationCode = `${prefix}-${appointment.id}`;
      
      // Send confirmation email
      try {
        const sgMail = await import('@sendgrid/mail');
        sgMail.default.setApiKey(process.env.SENDGRID_API_KEY!);
        
        // Generate QR code and confirmation page URL
        const baseUrl = process.env.BASE_URL || `https://${process.env.REPLIT_DEV_DOMAIN}` || 'http://localhost:5000';
        const confirmationUrl = `${baseUrl}/external/${slug}/confirmation/${confirmationCode}`;
        
        // Generate QR code using qrcode library
        const QRCode = await import('qrcode');
        const qrCodeDataUrl = await QRCode.toDataURL(confirmationUrl);
        
        const emailContent = {
          to: bookingData.email,
          from: 'noreply@dockoptimizer.com',
          subject: `Appointment Confirmation - ${confirmationCode}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Appointment Confirmed</h2>
              <p>Your dock appointment has been successfully scheduled.</p>
              
              <div style="background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 8px;">
                <h3 style="margin-top: 0;">Appointment Details</h3>
                <strong>Confirmation Code:</strong> ${confirmationCode}<br>
                <strong>Date:</strong> ${bookingData.date}<br>
                <strong>Time:</strong> ${bookingData.time}<br>
                <strong>Facility:</strong> ${facility?.name}<br>
                <strong>Service:</strong> ${appointmentType?.name}<br>
                <strong>Customer:</strong> ${bookingData.customerName}<br>
                <strong>Type:</strong> ${bookingData.pickupOrDropoff}
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <img src="${qrCodeDataUrl}" alt="QR Code for Check-in" style="width: 150px; height: 150px;">
                <p style="color: #666; font-size: 14px;">Scan this QR code for quick check-in at the facility</p>
              </div>
              
              <div style="background: #e3f2fd; padding: 15px; margin: 20px 0; border-radius: 8px;">
                <p style="margin: 0;"><strong>Manage Your Appointment:</strong></p>
                <p style="margin: 5px 0 0 0;">
                  <a href="${confirmationUrl}" style="color: #1976d2; text-decoration: none;">
                    View, Edit, Reschedule, or Cancel Your Appointment
                  </a>
                </p>
              </div>
              
              <p>Please keep your confirmation code for check-in and arrive on time for your scheduled appointment.</p>
              
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
              <p style="color: #666; font-size: 12px;">
                This is an automated message from Dock Optimizer. Please do not reply to this email.
              </p>
            </div>
          `
        };
        
        await sgMail.default.send(emailContent);
        console.log(`Confirmation email sent to ${bookingData.email}`);
      } catch (emailError) {
        console.error('Error sending confirmation email:', emailError);
        // Continue with response even if email fails
      }
      
      res.json({
        success: true,
        confirmationCode,
        schedule: appointment,
        message: 'Appointment booked successfully'
      });
    } catch (error) {
      console.error('Error creating booking:', error);
      res.status(500).json({ 
        error: 'Failed to create booking',
        message: error.message 
      });
    }
  });
  
  // Create the HTTP server
  const httpServer = createServer(app);
  
  // Create a WebSocket server
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/ws'
  });
  
  // Handle WebSocket connections
  wss.on('connection', (ws: TenantWebSocket) => {
    console.log('WebSocket client connected');
    
    // Set up ping interval for this connection
    ws.isAlive = true;
    
    // Handle client messages
    ws.on('message', (message) => {
      try {
        // Log the received message for debugging
        console.log(`Received message: ${message}`);
      } catch (err) {
        console.error('Error processing WebSocket message:', err);
      }
    });
    
    // Handle client disconnection
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });
  });
  
  // Set up regular pings to keep connections alive
  setInterval(() => {
    wss.clients.forEach((ws: any) => {
      const tenantWs = ws as TenantWebSocket;
      
      if (tenantWs.isAlive === false) {
        console.log('Terminating inactive WebSocket client');
        return tenantWs.terminate();
      }
      
      tenantWs.isAlive = false;
      tenantWs.ping();
    });
  }, 30000); // Check every 30 seconds
  
  // BOL Upload endpoint
  app.post('/api/upload-bol', upload.single('bolFile'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          error: 'No file uploaded' 
        });
      }

      // Return a simple success response with basic metadata
      const response = {
        success: true,
        message: 'BOL file uploaded successfully',
        metadata: {
          bolNumber: req.body.bolNumber || `BOL-${Date.now()}`,
          mcNumber: req.body.mcNumber || '',
          trailerNumber: req.body.trailerNumber || '',
          originalFileName: req.file.originalname,
          fileSize: req.file.size
        },
        fileUrl: `/uploads/${req.file.filename}`
      };

      res.json(response);
    } catch (error) {
      console.error('BOL upload error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to process BOL file' 
      });
    }
  });

  // Custom questions endpoints for booking pages
  app.get('/api/booking-pages/:slug/custom-questions', async (req, res) => {
    try {
      const { slug } = req.params;
      
      // Return empty array to prevent SyntaxError and allow booking flow to continue
      res.json([]);
    } catch (error) {
      console.error('Error fetching custom questions:', error);
      res.status(500).json({ error: 'Failed to fetch custom questions' });
    }
  });

  // Standard questions endpoints for appointment types
  app.get('/api/appointment-types/:id/standard-questions', async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get appointment type to determine tenant
      const appointmentType = await storage.getAppointmentType(parseInt(id));
      if (!appointmentType) {
        return res.json([]);
      }
      
      // Get dynamic fields for this appointment type's tenant
      const fields = await storage.getAppointmentTypeFields(appointmentType.tenantId || 0);
      
      // Filter fields for this specific appointment type
      const typeFields = fields.filter(field => field.appointmentTypeId === parseInt(id));
      
      // Transform to standard questions format using only available fields
      const standardQuestions = typeFields.map((field, index) => ({
        id: field.appointmentTypeId * 1000 + index, // Generate ID from appointment type and index
        fieldKey: field.fieldKey,
        fieldLabel: field.label,
        label: field.label,
        fieldType: field.fieldType,
        required: field.required || false,  // Use 'required' for consistency
        isRequired: field.required || false, // Also provide 'isRequired' for backward compatibility
        appointmentTypeId: field.appointmentTypeId,
        options: [], // Default empty array since options aren't stored in this structure
        orderPosition: field.orderPosition || 0,
        included: field.included !== false, // Default to true if not specified
        placeholder: '', // Default empty string since placeholder isn't stored
        defaultValue: '' // Default empty string since defaultValue isn't stored
      }));
      
      console.log(`[API] Standard questions for appointment type ${id}:`, standardQuestions);
      
      res.json(standardQuestions);
    } catch (error) {
      console.error('Error fetching standard questions:', error);
      res.status(500).json({ error: 'Failed to fetch standard questions' });
    }
  });

  // Alternative endpoint path for standard questions (for better URL structure)
  app.get('/api/standard-questions/appointment-type/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { bookingPageSlug } = req.query;
      
      console.log(`[API] Fetching standard questions for appointment type ${id}, booking page: ${bookingPageSlug}`);
      
      // Get appointment type to determine tenant
      const appointmentType = await storage.getAppointmentType(parseInt(id));
      if (!appointmentType) {
        console.log(`[API] Appointment type ${id} not found`);
        return res.json([]);
      }
      
      // Get dynamic fields for this appointment type's tenant
      const fields = await storage.getAppointmentTypeFields(appointmentType.tenantId || 0);
      
      // Filter fields for this specific appointment type
      const typeFields = fields.filter(field => field.appointmentTypeId === parseInt(id));
      
      // Transform to standard questions format using only available fields
      const standardQuestions = typeFields.map((field, index) => ({
        id: field.appointmentTypeId * 1000 + index, // Generate ID from appointment type and index
        fieldKey: field.fieldKey,
        fieldLabel: field.label,
        label: field.label,
        fieldType: field.fieldType,
        required: field.required || false,  // Use 'required' for consistency
        isRequired: field.required || false, // Also provide 'isRequired' for backward compatibility
        appointmentTypeId: field.appointmentTypeId,
        options: [], // Default empty array since options aren't stored in this structure
        orderPosition: field.orderPosition || 0,
        included: field.included !== false, // Default to true if not specified
        placeholder: '', // Default empty string since placeholder isn't stored
        defaultValue: '' // Default empty string since defaultValue isn't stored
      }));
      
      console.log(`[API] Returning ${standardQuestions.length} standard questions for appointment type ${id}`);
      
      res.json(standardQuestions);
    } catch (error) {
      console.error('Error fetching standard questions:', error);
      res.status(500).json({ error: 'Failed to fetch standard questions' });
    }
  });

  // Appointment type fields endpoint for dynamic columns
  app.get('/api/appointment-types/:organizationId/fields', async (req, res) => {
    try {
      const { organizationId } = req.params;
      const orgId = parseInt(organizationId);
      
      if (isNaN(orgId)) {
        return res.status(400).json({ error: 'Invalid organization ID' });
      }
      
      const fields = await storage.getAppointmentTypeFields(orgId);
      res.json(fields);
    } catch (error) {
      console.error('Error fetching appointment type fields:', error);
      res.status(500).json({ error: 'Failed to fetch appointment type fields' });
    }
  });

  // Availability slots endpoint for real-time slot checking
  app.get('/api/availability-slots', async (req: any, res) => {
    try {
      const { facilityId, appointmentTypeId, date, bookingPageSlug } = req.query;
      
      if (!facilityId || !appointmentTypeId || !date) {
        return res.status(400).json({ 
          error: 'Missing required parameters: facilityId, appointmentTypeId, date' 
        });
      }
      
      // Get tenant context from booking page if provided
      let tenantId;
      if (bookingPageSlug) {
        const bookingPage = await storage.getBookingPageBySlug(bookingPageSlug);
        if (!bookingPage) {
          return res.status(404).json({ error: 'Booking page not found' });
        }
        tenantId = bookingPage.tenantId;
      } else if (req.isAuthenticated?.()) {
        tenantId = req.user.tenantId;
      } else {
        return res.status(401).json({ error: 'Authentication required or booking page slug needed' });
      }
      
      // Import and use availability service
      const { calculateAvailabilitySlots } = await import('./src/services/availability');
      
      const slots = await calculateAvailabilitySlots(
        db,
        storage,
        date,
        parseInt(facilityId),
        parseInt(appointmentTypeId),
        tenantId
      );
      
      console.log(`[Availability API] Returning ${slots.length} slots for facility ${facilityId}, type ${appointmentTypeId}, date ${date}`);
      res.json(slots);
    } catch (error) {
      console.error('Error calculating availability slots:', error);
      res.status(500).json({ error: 'Failed to calculate availability slots' });
    }
  });

  // GET /api/facilities/:facilityId/appointment-settings
  app.get('/api/facilities/:facilityId/appointment-settings', async (req, res) => {
    try {
      const facilityId = parseInt(req.params.facilityId);
      if (isNaN(facilityId)) {
        return res.status(400).json({ message: 'Invalid facility ID' });
      }

      const settings = await storage.getAppointmentSettings(facilityId);
      
      if (!settings) {
        // Return default settings if none exist
        const defaultSettings = {
          id: null,
          facilityId,
          timeInterval: 30,
          maxConcurrentInbound: 2,
          maxConcurrentOutbound: 2,
          shareAvailabilityInfo: true,
          createdAt: new Date(),
          lastModifiedAt: new Date()
        };
        return res.json(defaultSettings);
      }

      res.json(settings);
    } catch (error) {
      console.error('Error fetching appointment settings:', error);
      res.status(500).json({ message: 'Failed to fetch appointment settings' });
    }
  });

  // PUT /api/facilities/:facilityId/appointment-settings
  app.put('/api/facilities/:facilityId/appointment-settings', async (req, res) => {
    try {
      const facilityId = parseInt(req.params.facilityId);
      if (isNaN(facilityId)) {
        return res.status(400).json({ message: 'Invalid facility ID' });
      }

      const updatedSettings = await storage.updateAppointmentSettings(facilityId, req.body);
      
      res.json(updatedSettings);
    } catch (error) {
      console.error('Error updating appointment settings:', error);
      res.status(500).json({ message: 'Failed to update appointment settings' });
    }
  });

  // GET /api/system-settings
  app.get('/api/system-settings', async (req, res) => {
    try {
      // For now, return default system settings
      // In a real implementation, these would be stored in a database
      const defaultSettings = {
        emailConfirmations: true,
        emailReminders: true,
        defaultCalendarView: "week",
        weekStartsOn: "1",
        maxDaysInAdvance: "90",
        minNoticeHours: "24"
      };
      
      res.json(defaultSettings);
    } catch (error) {
      console.error('Error fetching system settings:', error);
      res.status(500).json({ message: 'Failed to fetch system settings' });
    }
  });

  // PUT /api/system-settings
  app.put('/api/system-settings', async (req, res) => {
    try {
      // For now, just return success - can be expanded later to store in database
      const settings = req.body;
      console.log('System settings received:', settings);
      
      res.json({
        message: 'System settings saved successfully',
        settings
      });
    } catch (error) {
      console.error('Error saving system settings:', error);
      res.status(500).json({ message: 'Failed to save system settings' });
    }
  });

  // Enhanced notifications endpoint with upcoming appointments
  app.get('/api/notifications', async (req, res) => {
    try {
      const userId = req.user?.id;
      const tenantId = req.user?.tenantId;
      
      if (!userId || !tenantId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Get upcoming appointments (next 48 hours)
      const now = new Date();
      const next48Hours = new Date(now.getTime() + (48 * 60 * 60 * 1000));
      
      const upcomingAppointments = await storage.getSchedulesByDateRange(now, next48Hours);
      
      // Filter appointments for user's tenant and future appointments only
      const relevantAppointments = upcomingAppointments
        .filter(apt => {
          // Filter by tenant via facility check and ensure appointment has required fields
          return apt.facilityId && apt.startTime > now && apt.truckNumber;
        })
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

      // Create notifications from upcoming appointments
      const appointmentNotifications = relevantAppointments.slice(0, 10).map(apt => {
        const timeUntil = new Date(apt.startTime).getTime() - now.getTime();
        const hoursUntil = Math.floor(timeUntil / (1000 * 60 * 60));
        const minutesUntil = Math.floor((timeUntil % (1000 * 60 * 60)) / (1000 * 60));
        
        let timeText = '';
        let urgency = 'normal';
        let backgroundColor = '#f8f9fa';
        
        if (hoursUntil < 0) {
          timeText = 'Overdue';
          urgency = 'critical';
          backgroundColor = '#fff5f5';
        } else if (hoursUntil === 0 && minutesUntil <= 30) {
          timeText = minutesUntil <= 15 ? `${minutesUntil}m` : `${minutesUntil}m`;
          urgency = 'urgent';
          backgroundColor = '#fef3cd';
        } else if (hoursUntil <= 2) {
          timeText = `${hoursUntil}h ${minutesUntil}m`;
          urgency = 'warning';
          backgroundColor = '#d1ecf1';
        } else if (hoursUntil <= 24) {
          timeText = `${hoursUntil}h`;
          urgency = 'info';
          backgroundColor = '#d4edda';
        } else {
          const daysUntil = Math.floor(hoursUntil / 24);
          timeText = `${daysUntil}d`;
          urgency = 'normal';
        }

        return {
          id: `apt-${apt.id}`,
          type: 'appointment',
          urgency,
          title: `${apt.type === 'inbound' ? 'Inbound' : 'Outbound'} Appointment`,
          message: `${apt.truckNumber || 'Vehicle'} • ${apt.customerName || 'Customer'} • ${timeText}`,
          appointmentId: apt.id,
          startTime: apt.startTime,
          status: apt.status,
          facilityId: apt.facilityId,
          isRead: false,
          createdAt: apt.createdAt,
          metadata: {
            confirmationCode: apt.id.toString().padStart(6, '0'),
            truckNumber: apt.truckNumber,
            customerName: apt.customerName,
            driverName: apt.driverName,
            driverPhone: apt.driverPhone,
            timeUntil: timeText,
            urgency: urgency,
            backgroundColor: backgroundColor
          }
        };
      });

      // Get system notifications from database (if any)
      const systemNotifications = await storage.getNotificationsByUser(userId);
      
      // Combine and format all notifications
      const allNotifications = [
        ...appointmentNotifications,
        ...systemNotifications.map(notif => ({
          ...notif,
          type: 'system',
          urgency: 'normal',
          metadata: {}
        }))
      ].sort((a, b) => {
        // Sort by urgency first, then by time
        const urgencyOrder = { critical: 0, urgent: 1, warning: 2, info: 3, normal: 4 };
        const aUrgency = urgencyOrder[a.urgency] || 4;
        const bUrgency = urgencyOrder[b.urgency] || 4;
        
        if (aUrgency !== bUrgency) {
          return aUrgency - bUrgency;
        }
        
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      res.json(allNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ message: 'Failed to fetch notifications' });
    }
  });

  // Mark notification as read
  app.put('/api/notifications/:id/read', async (req, res) => {
    try {
      const notificationId = req.params.id;
      
      // Handle appointment notifications vs system notifications
      if (notificationId.startsWith('apt-')) {
        // For appointment notifications, just return success (they're generated dynamically)
        res.json({ message: 'Appointment notification marked as read' });
      } else {
        // For system notifications, update in database
        const id = parseInt(notificationId);
        if (isNaN(id)) {
          return res.status(400).json({ message: 'Invalid notification ID' });
        }
        
        const notification = await storage.markNotificationAsRead(id);
        if (!notification) {
          return res.status(404).json({ message: 'Notification not found' });
        }
        
        res.json(notification);
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({ message: 'Failed to mark notification as read' });
    }
  });

  // Debug endpoints for testing
  app.get('/api/test', (req, res) => {
    res.json({ 
      status: 'ok', 
      message: 'API is responding',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      database: process.env.DATABASE_URL ? 'configured' : 'not configured'
    });
  });

  app.get('/api/test/db-connection', async (req, res) => {
    try {
      const storage = await getStorage();
      // Try a simple query - use getFacilities instead of list
      let facilitiesCount = 0;
      try {
        if (typeof storage.getFacilities === 'function') {
          const facilities = await storage.getFacilities();
          facilitiesCount = facilities.length;
        } else if (typeof storage.list === 'function') {
          const facilities = await storage.list();
          facilitiesCount = facilities.length;
        }
      } catch (facilityError) {
        console.warn('Could not get facilities, but storage is connected:', facilityError);
      }
      
      res.json({ 
        status: 'ok', 
        message: 'Database connection successful',
        storageType: storage.constructor.name,
        facilitiesCount: facilitiesCount,
        availableMethods: Object.getOwnPropertyNames(Object.getPrototypeOf(storage))
      });
    } catch (error: any) {
      console.error('Database connection test failed:', error);
      res.status(500).json({ 
        status: 'error', 
        message: 'Database connection failed',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.get('/api/test/company-assets', async (req, res) => {
    try {
      const storage = await getStorage();
      const assets = await storage.getCompanyAssets();
      res.json({ 
        status: 'ok', 
        message: 'Company assets query successful',
        assetsCount: assets.length,
        sampleAsset: assets.length > 0 ? assets[0] : null
      });
    } catch (error: any) {
      console.error('Company assets test failed:', error);
      res.status(500).json({ 
        status: 'error', 
        message: 'Company assets query failed',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  console.log('Core routes registered successfully');
  
  return httpServer;
}