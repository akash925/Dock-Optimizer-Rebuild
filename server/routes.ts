import type { Express } from "express";
import { createServer, type Server } from "http";
import { getStorage } from "./storage";
import { setupAuth } from "./auth";
import path from "path";
import multer from "multer";
import fs from "fs";
import { WebSocketServer } from "ws";
import { db } from "./db";
import fileRoutes from "./routes/files";

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
  
  // Setup authentication routes
  setupAuth(app);
  
  // File upload and serving routes
  app.use('/api/files', fileRoutes);
  
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
      const appointmentTypeFields = await storage.getAppointmentTypeFields();
      
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
      
      // Parse the selected time as facility timezone, not UTC
      const facilityDateTime = new Date(`${bookingData.date}T${bookingData.time}:00`);
      // Convert to UTC by adjusting for timezone offset
      const utcStartTime = new Date(facilityDateTime.getTime() - (facilityDateTime.getTimezoneOffset() * 60000));
      
      // Get appointment type for duration
      const appointmentType = await storage.getAppointmentType(bookingData.appointmentTypeId);
      const durationHours = appointmentType?.duration || 1;
      const utcEndTime = new Date(utcStartTime.getTime() + (durationHours * 60 * 60 * 1000));
      
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
      // Get organization details to determine the proper prefix
      const organization = facility ? await storage.getTenantById(facility.tenantId!) : null;
      
      // Use organization-specific prefix or fallback to HZL for Hanzo
      let prefix = 'HZL'; // Default for Hanzo Logistics
      if (organization && organization.name) {
        // Extract initials from organization name
        const words = organization.name.split(' ');
        if (words.length >= 2) {
          prefix = words.map(word => word.charAt(0).toUpperCase()).join('').substring(0, 3);
        } else if (words[0].length >= 3) {
          prefix = words[0].substring(0, 3).toUpperCase();
        }
      }
      
      const confirmationCode = `${prefix}-${appointment.id}`;
      
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
      
      // Transform to standard questions format
      const standardQuestions = typeFields.map(field => ({
        fieldKey: field.fieldKey,
        fieldLabel: field.label,
        fieldType: field.fieldType,
        required: field.required || false,
        appointmentTypeId: field.appointmentTypeId
      }));
      
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

  console.log('Core routes registered successfully');
  
  return httpServer;
}