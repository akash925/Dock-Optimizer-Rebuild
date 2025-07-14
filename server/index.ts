// Environment variables are loaded by Doppler CLI

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";
import fs from "fs";
import { tenantMiddleware } from "./middleware/tenant";
import { initializeWebSocket } from "./websocket/index";

// Environment variable checks
const requiredEnvVars = [
  'DATABASE_URL',
  'SENDGRID_API_KEY',
  'AWS_S3_BUCKET',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
];

const missingVars = requiredEnvVars.filter(v => !process.env[v]);

if (missingVars.length > 0) {
  console.error(`❌ Missing critical environment variables: ${missingVars.join(', ')}`);
  console.error('Please ensure these are configured in your .env file or hosting environment.');
  process.exit(1);
}

// Production logging and error handling

// Default system modules (always loaded)
const SYSTEM_MODULES = ["tenants", "featureFlags", "modules", "organizations", "admin"];

// Tenant-specific modules (loaded based on tenant configuration)
const AVAILABLE_MODULES = [
  "companyAssets",
  "calendar",
  "analytics",
  "bookingPages",
  "emailNotifications",
];

// Check if Asset Manager module is enabled globally (legacy support)
const ENABLE_ASSET_MANAGER = process.env.ENABLE_ASSET_MANAGER === "true";

// Get list of enabled modules from environment variable (legacy support)
const ENABLED_MODULES = (process.env.ENABLED_MODULES || "")
  .split(",")
  .filter(Boolean);

// FIXED: Make Asset Manager available by default so organizations can choose to enable it
// This makes the module available as an option, but doesn't force it on all orgs
const MAKE_ASSET_MANAGER_AVAILABLE = true;

// Log enabled modules for backward compatibility
console.log(
  `Asset Manager module is ${(ENABLE_ASSET_MANAGER || MAKE_ASSET_MANAGER_AVAILABLE) ? "available" : "disabled"}`,
);
console.log(
  `Enabled modules: ${ENABLED_MODULES.length ? ENABLED_MODULES.join(", ") : "none"}`,
);

import bookingPublicRouter from "./routes/public/booking"; // Adjust path if needed

const app = express();
// Increase JSON payload size limit to 5MB for logo uploads
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: false, limit: "5mb" }));
app.use("/api", bookingPublicRouter);

// Add tenant identification middleware
app.use(tenantMiddleware);

// Serve files from the uploads directory
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// For tests that need synchronous app import, use test-app.ts instead
// This export provides the basic app instance but routes are set up asynchronously
export { app };
export default app;

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Register core routes (includes authentication setup)
  const server = await registerRoutes(app);
  
  // 🔥 CRITICAL: Initialize WebSocket for real-time updates
  try {
    const { getStorage } = await import('./storage');
    const storage = await getStorage();
    const wsHandler = initializeWebSocket(server, storage);
    console.log('✅ WebSocket real-time updates initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize WebSocket:', error);
  }

  // Register booking pages logo endpoint (public API)
  try {
    const { registerBookingPagesLogoEndpoint } = await import('./endpoints/booking-pages-logo');
    registerBookingPagesLogoEndpoint(app);
    console.log('✅ Booking pages logo endpoint registered successfully');
  } catch (error) {
    console.error('❌ Failed to register booking pages logo endpoint:', error);
  }

  // NOW ADD CRITICAL API ROUTES AFTER AUTHENTICATION IS SET UP
  
  // Users API - Required for user management components
  app.get('/api/users', async (req: any, res) => {
    try {
      // Import storage dynamically to avoid circular dependencies
      const { getStorage } = await import('./storage');
      const storage = await getStorage();

      // Require authentication for user data
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Require tenant context for security
      if (!req.user?.tenantId) {
        return res.status(403).json({ error: 'Tenant context required' });
      }

      console.log(`[UsersAPI] Processing request for tenant ${req.user.tenantId}`);

      // Get users for this tenant only
      const tenantUsers = await storage.getOrganizationUsers(req.user.tenantId);
      
      // Enhance with user details
      const users = await Promise.all(tenantUsers.map(async (orgUser) => {
        const user = await storage.getUser(orgUser.userId);
        const role = await storage.getRole(orgUser.roleId);
        
        if (!user || !role) {
          return null;
        }
        
        // Return safe user data (no password)
        const { password, ...safeUser } = user;
        return {
          ...safeUser,
          firstName: user.firstName ?? null,
          lastName: user.lastName ?? null,
          role: role.name,
          organizationRole: role.name
        };
      }));

      // Filter out null entries
      const validUsers = users.filter(user => user !== null);

      console.log(`[UsersAPI] Returning ${validUsers.length} users for tenant ${req.user.tenantId}`);
      res.json(validUsers);
      
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  // Booking Pages API - Required for booking page management
  app.get('/api/booking-pages', async (req: any, res) => {
    try {
      // Import storage dynamically to avoid circular dependencies
      const { getStorage } = await import('./storage');
      const storage = await getStorage();

      // Require authentication for booking page management
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Require tenant context for security
      if (!req.user?.tenantId) {
        return res.status(403).json({ error: 'Tenant context required' });
      }

      console.log(`[BookingPagesAPI] Processing request for tenant ${req.user.tenantId}`);

      // Get all booking pages for this tenant
      const allBookingPages = await storage.getBookingPages();
      
      // Filter by tenant ID for proper isolation
      const tenantBookingPages = allBookingPages.filter(page => page.tenantId === req.user.tenantId);

      console.log(`[BookingPagesAPI] Returning ${tenantBookingPages.length} booking pages for tenant ${req.user.tenantId}`);
      res.json(tenantBookingPages);
      
    } catch (error) {
      console.error('Error fetching booking pages:', error);
      res.status(500).json({ error: 'Failed to fetch booking pages' });
    }
  });

  // Appointment Types API - Required for appointment master management
  app.get('/api/appointment-types', async (req: any, res) => {
    try {
      // Import storage dynamically to avoid circular dependencies
      const { getStorage } = await import('./storage');
      const storage = await getStorage();

      // Require authentication for appointment type management
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Require tenant context for security
      if (!req.user?.tenantId) {
        return res.status(403).json({ error: 'Tenant context required' });
      }

      console.log(`[AppointmentTypesAPI] Processing request for tenant ${req.user.tenantId}`);

      // Get all appointment types for this tenant
      const tenantAppointmentTypes = await storage.getAppointmentTypes(req.user.tenantId);

      console.log(`[AppointmentTypesAPI] Returning ${tenantAppointmentTypes.length} appointment types for tenant ${req.user.tenantId}`);
      res.json(tenantAppointmentTypes);
      
    } catch (error) {
      console.error('Error fetching appointment types:', error);
      res.status(500).json({ error: 'Failed to fetch appointment types' });
    }
  });

  // Create Appointment Type API
  app.post('/api/appointment-types', async (req: any, res) => {
    try {
      // Import storage and service dynamically to avoid circular dependencies
      const { getStorage } = await import('./storage');
      const { appointmentMasterService } = await import('./modules/appointmentMaster/service');
      const storage = await getStorage();

      // Require authentication
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Require tenant context for security
      if (!req.user?.tenantId) {
        return res.status(403).json({ error: 'Tenant context required' });
      }

      // Add tenant ID to the appointment type data and ensure questions array is present
      const appointmentTypeData = {
        ...req.body,
        tenantId: req.user.tenantId,
        // Ensure questions array is always present, even if empty
        questions: req.body.questions || []
      };

      console.log(`[AppointmentTypesAPI] Creating appointment type for tenant ${req.user.tenantId}:`, appointmentTypeData.name);

      // Create the appointment type
      const createdAppointmentType = await storage.createAppointmentType(appointmentTypeData);

      // If there are questions, use the appointment master service to properly save them with correct field mapping
      if (appointmentTypeData.questions && appointmentTypeData.questions.length > 0) {
        console.log(`[AppointmentTypesAPI] Processing ${appointmentTypeData.questions.length} questions with proper field mapping`);
        try {
          await appointmentMasterService.saveAppointmentType(createdAppointmentType.id, appointmentTypeData);
        } catch (questionError) {
          console.error('Error saving questions for appointment type:', questionError);
          // Don't fail the entire request if questions fail to save
        }
      }

      console.log(`[AppointmentTypesAPI] Successfully created appointment type: ${createdAppointmentType.name} (ID: ${createdAppointmentType.id})`);
      res.status(201).json(createdAppointmentType);
      
    } catch (error) {
      console.error('Error creating appointment type:', error);
      res.status(500).json({ error: 'Failed to create appointment type' });
    }
  });

  // Update Appointment Type API
  app.put('/api/appointment-types/:id', async (req: any, res) => {
    try {
      const { getStorage } = await import('./storage');
      const { appointmentMasterService } = await import('./modules/appointmentMaster/service');
      const storage = await getStorage();

      // Authentication required
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Tenant context required
      if (!req.user?.tenantId) {
        return res.status(403).json({ error: 'Tenant context required' });
      }

      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ error: 'Invalid appointment type id' });
      }

      // Ensure the appointment type belongs to this tenant
      const existing = await storage.getAppointmentType(id);
      if (!existing || existing.tenantId !== req.user.tenantId) {
        return res.status(404).json({ error: 'Appointment type not found' });
      }

      // Ensure questions array is present in the update data
      const updateData = {
        ...req.body,
        // Ensure questions array is always present, even if empty
        questions: req.body.questions || []
      };

      // Update the appointment type
      const updated = await storage.updateAppointmentType(id, updateData);
      if (!updated) {
        return res.status(500).json({ error: 'Failed to update appointment type' });
      }

      // Use the appointment master service to properly save questions with correct field mapping
      if (updateData.questions) {
        console.log(`[AppointmentTypesAPI] Processing ${updateData.questions.length} questions with proper field mapping`);
        try {
          await appointmentMasterService.saveAppointmentType(id, updateData);
        } catch (questionError) {
          console.error('Error saving questions for appointment type:', questionError);
          // Don't fail the entire request if questions fail to save
        }
      }

      return res.json(updated);
    } catch (error) {
      console.error('Error updating appointment type:', error);
      res.status(500).json({ error: 'Failed to update appointment type' });
    }
  });

  // Seed Standard Questions API
  app.post('/api/appointment-types/:id/seed-standard', async (req: any, res) => {
    try {
      const { getStorage } = await import('./storage');
      const storage = await getStorage();

      // Authentication required
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Tenant context required
      if (!req.user?.tenantId) {
        return res.status(403).json({ error: 'Tenant context required' });
      }

      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ error: 'Invalid appointment type id' });
      }

      // Ensure the appointment type belongs to this tenant
      const existing = await storage.getAppointmentType(id);
      if (!existing || existing.tenantId !== req.user.tenantId) {
        return res.status(404).json({ error: 'Appointment type not found' });
      }

      // Define standard questions to seed
      const standardQuestions = [
        { label: "Customer Name", fieldKey: "customerName", fieldType: "text", required: true, included: true, orderPosition: 1 },
        { label: "Carrier Name", fieldKey: "carrierName", fieldType: "text", required: true, included: true, orderPosition: 2 },
        { label: "Carrier MC #", fieldKey: "mcNumber", fieldType: "text", required: true, included: true, orderPosition: 3 },
        { label: "Driver/Dispatcher Email", fieldKey: "driverEmail", fieldType: "email", required: true, included: true, orderPosition: 4 },
        { label: "Driver/Dispatcher Phone Number", fieldKey: "driverPhone", fieldType: "text", required: false, included: true, orderPosition: 5 },
        { label: "Driver's License Number", fieldKey: "driverLicense", fieldType: "text", required: false, included: true, orderPosition: 6 },
        { label: "BOL Doc", fieldKey: "bolDoc", fieldType: "file", required: false, included: true, orderPosition: 7 },
        { label: "BOL Number", fieldKey: "bolNumber", fieldType: "text", required: true, included: true, orderPosition: 8 },
        { label: "Truck Number", fieldKey: "truckNumber", fieldType: "text", required: true, included: true, orderPosition: 9 },
        { label: "Trailer Number", fieldKey: "trailerNumber", fieldType: "text", required: false, included: true, orderPosition: 10 },
        { label: "Driver's Name", fieldKey: "driverName", fieldType: "text", required: false, included: true, orderPosition: 11 },
        { label: "Item Description/Quantity", fieldKey: "itemDescription", fieldType: "textarea", required: false, included: true, orderPosition: 12 }
      ];

      console.log(`[AppointmentTypesAPI] Seeding ${standardQuestions.length} standard questions for appointment type ${id}`);

      // Create all standard questions for this appointment type
      const createdQuestions = [];
      for (const question of standardQuestions) {
        try {
          const createdQuestion = await storage.createStandardQuestion({
            ...question,
            appointmentTypeId: id
          });
          createdQuestions.push(createdQuestion);
        } catch (error) {
          console.error(`Error creating standard question "${question.label}":`, error);
        }
      }

      console.log(`[AppointmentTypesAPI] Successfully seeded ${createdQuestions.length} standard questions`);
      res.status(201).json({ 
        success: true, 
        message: `Successfully seeded ${createdQuestions.length} standard questions`,
        questions: createdQuestions
      });
      
    } catch (error) {
      console.error('Error seeding standard questions:', error);
      res.status(500).json({ error: 'Failed to seed standard questions' });
    }
  });

  // NOTIFICATIONS API - Required for notification bell functionality
  app.get('/api/notifications/enhanced', async (req: any, res) => {
    try {
      const { getStorage } = await import('./storage');
      const storage = await getStorage();

      // Authentication required
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Get current user ID
      const userId = req.user?.id;
      if (!userId) {
        return res.status(403).json({ error: 'User context required' });
      }

      console.log(`[NotificationsAPI] Fetching notifications for user ${userId}`);

      // Get notifications for the current user
      const userNotifications = await storage.getNotificationsByUser(userId);
      
      // Transform notifications to enhanced format expected by the client
      const enhancedNotifications = userNotifications.map(notification => {
        // Determine urgency based on notification type
        let urgency = 'normal';
        if (notification.type === 'urgent' || notification.type === 'delay') {
          urgency = 'urgent';
        } else if (notification.type === 'critical') {
          urgency = 'critical';
        } else if (notification.type === 'warning') {
          urgency = 'warning';
        } else if (notification.type === 'info') {
          urgency = 'info';
        }

        return {
          id: notification.id,
          userId: notification.userId,
          title: notification.title,
          message: notification.message,
          isRead: notification.isRead,
          type: notification.type,
          urgency: urgency,
          relatedScheduleId: notification.relatedScheduleId,
          createdAt: notification.createdAt,
          metadata: {
            // Add any additional metadata that might be useful
            actionRequired: urgency === 'urgent' || urgency === 'critical',
            category: notification.type
          }
        };
      });

      console.log(`[NotificationsAPI] Returning ${enhancedNotifications.length} notifications for user ${userId}`);
      res.json(enhancedNotifications);
      
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  });

  // Mark notifications as read
  app.put('/api/notifications/mark-read', async (req: any, res) => {
    try {
      const { getStorage } = await import('./storage');
      const storage = await getStorage();

      // Authentication required
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = req.user?.id;
      if (!userId) {
        return res.status(403).json({ error: 'User context required' });
      }

      const { notificationIds } = req.body;
      if (!notificationIds || !Array.isArray(notificationIds)) {
        return res.status(400).json({ error: 'notificationIds array is required' });
      }

      console.log(`[NotificationsAPI] Marking ${notificationIds.length} notifications as read for user ${userId}`);

      // Mark each notification as read (with security check)
      const results = [];
      for (const notificationId of notificationIds) {
        try {
          const notification = await storage.getNotification(notificationId);
          if (notification && notification.userId === userId) {
            const updated = await storage.markNotificationAsRead(notificationId);
            results.push(updated);
          }
        } catch (error) {
          console.error(`Error marking notification ${notificationId} as read:`, error);
        }
      }

      console.log(`[NotificationsAPI] Successfully marked ${results.length} notifications as read`);
      res.json({ success: true, updatedCount: results.length });
      
    } catch (error) {
      console.error('Error marking notifications as read:', error);
      res.status(500).json({ error: 'Failed to mark notifications as read' });
    }
  });

  // Mark all notifications as read
  app.put('/api/notifications/mark-all-read', async (req: any, res) => {
    try {
      const { getStorage } = await import('./storage');
      const storage = await getStorage();

      // Authentication required
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = req.user?.id;
      if (!userId) {
        return res.status(403).json({ error: 'User context required' });
      }

      console.log(`[NotificationsAPI] Marking all notifications as read for user ${userId}`);

      // Get all unread notifications for the user
      const userNotifications = await storage.getNotificationsByUser(userId);
      const unreadNotifications = userNotifications.filter(n => !n.isRead);

      // Mark each unread notification as read
      const results = [];
      for (const notification of unreadNotifications) {
        try {
          const updated = await storage.markNotificationAsRead(notification.id);
          results.push(updated);
        } catch (error) {
          console.error(`Error marking notification ${notification.id} as read:`, error);
        }
      }

      console.log(`[NotificationsAPI] Successfully marked ${results.length} notifications as read`);
      res.json({ success: true, updatedCount: results.length });
      
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({ error: 'Failed to mark all notifications as read' });
    }
  });

  // Delete notifications - For now, just mark as read since delete is not implemented
  app.delete('/api/notifications', async (req: any, res) => {
    try {
      const { getStorage } = await import('./storage');
      const storage = await getStorage();

      // Authentication required
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = req.user?.id;
      if (!userId) {
        return res.status(403).json({ error: 'User context required' });
      }

      const { notificationIds } = req.body;
      if (!notificationIds || !Array.isArray(notificationIds)) {
        return res.status(400).json({ error: 'notificationIds array is required' });
      }

      console.log(`[NotificationsAPI] Marking ${notificationIds.length} notifications as read (delete not implemented) for user ${userId}`);

      // Mark each notification as read (since delete is not implemented)
      const results = [];
      for (const notificationId of notificationIds) {
        try {
          const notification = await storage.getNotification(notificationId);
          if (notification && notification.userId === userId) {
            const updated = await storage.markNotificationAsRead(notificationId);
            results.push(notificationId);
          }
        } catch (error) {
          console.error(`Error marking notification ${notificationId} as read:`, error);
        }
      }

      console.log(`[NotificationsAPI] Successfully marked ${results.length} notifications as read`);
      res.json({ success: true, deletedCount: results.length });
      
    } catch (error) {
      console.error('Error deleting notifications:', error);
      res.status(500).json({ error: 'Failed to delete notifications' });
    }
  });

  // Create sample notifications for testing (only in development)
  if (process.env.NODE_ENV === 'development') {
    app.post('/api/notifications/create-sample', async (req: any, res) => {
      try {
        const { getStorage } = await import('./storage');
        const storage = await getStorage();

        // Authentication required
        if (!req.isAuthenticated || !req.isAuthenticated()) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const userId = req.user?.id;
        if (!userId) {
          return res.status(403).json({ error: 'User context required' });
        }

        console.log(`[NotificationsAPI] Creating sample notifications for user ${userId}`);

        // Create sample notifications
        const sampleNotifications = [
          {
            userId: userId,
            title: 'New Appointment Created',
            message: 'Fresh Connect Logistics has scheduled a new inbound appointment for tomorrow at 2:00 PM',
            type: 'appointment',
            isRead: false
          },
          {
            userId: userId,
            title: 'Dock Assignment Updated',
            message: 'Appointment #12345 has been assigned to Dock A-3',
            type: 'info',
            isRead: false
          },
          {
            userId: userId,
            title: 'Urgent: Delivery Delay',
            message: 'Truck #TR-456 is running 30 minutes behind schedule',
            type: 'urgent',
            isRead: false
          },
          {
            userId: userId,
            title: 'Vehicle Checked In',
            message: 'Driver John Smith has checked in at the front gate',
            type: 'info',
            isRead: false
          }
        ];

        const createdNotifications = [];
        for (const notification of sampleNotifications) {
          try {
            const created = await storage.createNotification(notification);
            createdNotifications.push(created);
          } catch (error) {
            console.error('Error creating sample notification:', error);
          }
        }

        console.log(`[NotificationsAPI] Created ${createdNotifications.length} sample notifications`);
        res.json({ success: true, created: createdNotifications.length });
        
      } catch (error) {
        console.error('Error creating sample notifications:', error);
        res.status(500).json({ error: 'Failed to create sample notifications' });
      }
    });
  }

  // First, load system modules (tenant management and feature flags)
  for (const moduleName of SYSTEM_MODULES) {
    console.log(`Loading system module: ${moduleName}...`);
    try {
      const modulePath = `./modules/${moduleName}/index`;
      const module = await import(modulePath);
      if (module.default && typeof module.default.initialize === "function") {
        await module.default.initialize(app);
        console.log(`✅ ${moduleName} module loaded successfully`);
      } else {
        console.warn(`⚠️  Module ${moduleName} doesn't have a valid initialize function`);
      }
    } catch (error) {
      console.error(`❌ Failed to load system module ${moduleName}:`, error);
      // Continue gracefully - some modules may not be critical for basic functionality
      console.log(`🔧 Continuing without ${moduleName} module...`);
    }
  }

  // Load tenant-specific enabled modules
  // For backward compatibility, load modules from environment
  const modulesToLoad = [...ENABLED_MODULES];
  if ((ENABLE_ASSET_MANAGER || MAKE_ASSET_MANAGER_AVAILABLE) && !modulesToLoad.includes("companyAssets")) {
    modulesToLoad.push("companyAssets");
  }

  // Add essential modules to ensure API routes are available
  const essentialModules = ["facilityManagement", "calendar", "analytics"];
  essentialModules.forEach(module => {
    if (!modulesToLoad.includes(module)) {
      modulesToLoad.push(module);
    }
  });

  // Load modules with graceful error handling
  let loadedModules = 0;
  let failedModules = 0;
  
  for (const moduleName of modulesToLoad) {
    console.log(`Loading ${moduleName} module...`);
    try {
      const modulePath = `./modules/${moduleName}/index`;
      const module = await import(modulePath);
      if (module.default && typeof module.default.initialize === "function") {
        await module.default.initialize(app);
        console.log(`✅ ${moduleName} module loaded successfully`);
        loadedModules++;
      } else {
        console.warn(`⚠️  Module ${moduleName} doesn't have a valid initialize function`);
        failedModules++;
      }
    } catch (error) {
      console.error(`❌ Failed to load ${moduleName} module:`, error);
      console.log(`🔧 Continuing without ${moduleName} module...`);
      failedModules++;
    }
  }
  
  console.log(`📊 Module loading complete: ${loadedModules} loaded, ${failedModules} failed`);
  console.log(`🚀 Server starting with core functionality available`);

  // CRITICAL: Initialize self-healing OCR service
  console.log('Initializing OCR service...');
  try {
    // Import and start the self-healing OCR service
    const { startOcrService, getOcrStatus } = await import('./services/ocrStarter');
    await startOcrService();
    
    // Add OCR status endpoint
    app.get('/api/ocr/status', async (_req, res) => {
      const status = await getOcrStatus();
      res.json(status);
    });
    
    // Import the OCR routes module
    const ocrModule = await import('./routes/bol-ocr.mjs' as string);
    
    // Register OCR routes with proper error handling
    if (ocrModule && (ocrModule as any).default) {
      app.use('/api/ocr', (ocrModule as any).default);
      console.log('✅ OCR module routes registered successfully at /api/ocr');
      
      // Test OCR service status
      try {
        const status = await getOcrStatus();
        console.log(`✅ OCR service ready with backend: ${status.backend}`);
        console.log('📄 OCR endpoints available:');
        console.log('   POST /api/ocr/upload - Upload and process documents');
        console.log('   GET  /api/ocr/status - Check OCR service status');
        
      } catch (testError) {
        console.warn('⚠️  OCR service test failed, but routes are registered:', testError);
      }
      
    } else {
      console.error('❌ OCR module default export not found');
    }
    
  } catch (error) {
    console.error('❌ Failed to initialize OCR service:', error);
    console.log('🔧 OCR service will not be available - continuing without it');
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Serve the app on the configured port
  // For Replit: process.env.PORT is automatically set
  // For local development: defaults to 5001
  const PORT = parseInt(process.env.PORT || '5001', 10);
  
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[express] 🔧 Server listening on port ${PORT}`);
    if (process.env.NODE_ENV === 'production') {
      console.log('🚀 Production server ready!');
    } else {
      console.log('🔧 Development server ready!');
    }
  });
})();

// Early error logging
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

console.log('🚀 Starting Dock Optimizer server...');
console.log('📊 Environment:', process.env.NODE_ENV || 'development');
console.log('🗄️ Database URL configured:', !!process.env.DATABASE_URL);
console.log('☁️ S3 configured:', !!process.env.AWS_S3_BUCKET);
