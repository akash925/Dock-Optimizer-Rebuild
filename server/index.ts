// CRITICAL: Load environment variables FIRST before any other imports
import dotenv from "dotenv";
dotenv.config();

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";
import fs from "fs";
import { tenantMiddleware } from "./middleware/tenant";
import { initializeWebSocket } from "./websocket/index";

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
      const allAppointmentTypes = await storage.getAppointmentTypes();
      
      // Filter by tenant ID for proper isolation
      const tenantAppointmentTypes = allAppointmentTypes.filter(type => type.tenantId === req.user.tenantId);

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
      // Import storage dynamically to avoid circular dependencies
      const { getStorage } = await import('./storage');
      const storage = await getStorage();

      // Require authentication
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Require tenant context for security
      if (!req.user?.tenantId) {
        return res.status(403).json({ error: 'Tenant context required' });
      }

      // Add tenant ID to the appointment type data
      const appointmentTypeData = {
        ...req.body,
        tenantId: req.user.tenantId
      };

      console.log(`[AppointmentTypesAPI] Creating appointment type for tenant ${req.user.tenantId}:`, appointmentTypeData.name);

      // Create the appointment type
      const createdAppointmentType = await storage.createAppointmentType(appointmentTypeData);

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

      const updated = await storage.updateAppointmentType(id, req.body);
      if (!updated) {
        return res.status(500).json({ error: 'Failed to update appointment type' });
      }

      return res.json(updated);
    } catch (error) {
      console.error('Error updating appointment type:', error);
      res.status(500).json({ error: 'Failed to update appointment type' });
    }
  });

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
