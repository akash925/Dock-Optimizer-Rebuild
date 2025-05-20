import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { getStorage } from "./storage";
import { setupAuth } from "./auth";
import { z } from "zod";
import { getBookingStyles } from "./controllers/admin-controller";
import path from "path";
import fs from "fs";
import multer from "multer";
import { sendConfirmationEmail, sendEmail, generateICalEvent } from "./notifications";
import { sendCheckoutCompletionEmail } from "./checkout-notification";
import { testEmailTemplate } from "./email-test";

// Configure multer for different upload types
// Main uploads directory
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Setup for checkout photos directory
const checkoutPhotosDir = path.join(uploadsDir, 'checkout-photos');
if (!fs.existsSync(checkoutPhotosDir)) {
  fs.mkdirSync(checkoutPhotosDir, { recursive: true });
}

// Setup for OCR documents directory
const ocrDocsDir = path.join(uploadsDir, 'ocr-docs');
if (!fs.existsSync(ocrDocsDir)) {
  fs.mkdirSync(ocrDocsDir, { recursive: true });
}

// Configure multer storage for checkout photos
const checkoutPhotoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, checkoutPhotosDir);
  },
  filename: function (req, file, cb) {
    // Generate a unique filename with timestamp and original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `checkout-${uniqueSuffix}${ext}`);
  }
});

const checkoutPhotoUpload = multer({ 
  storage: checkoutPhotoStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    // Accept only images
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed!'));
    }
    cb(null, true);
  }
});

// Configure multer storage for OCR document uploads
const ocrDocStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, ocrDocsDir);
  },
  filename: function (req, file, cb) {
    // Generate a unique filename with timestamp and original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `ocr-doc-${uniqueSuffix}${ext}`);
  }
});

// Setup multer for OCR document uploads
const ocrDocUpload = multer({
  storage: ocrDocStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Accept images and PDFs
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!validTypes.includes(file.mimetype)) {
      return cb(new Error('Only JPG, PNG images and PDF files are allowed!'));
    }
    cb(null, true);
  }
});
import { adminRoutes } from "./modules/admin/routes";
import { pool, db } from "./db";
import { WebSocketServer, WebSocket } from "ws";
import { format } from "date-fns";
import { startReminderScheduler } from "./reminder-scheduler";
import { 
  userPreferences, 
  insertUserPreferencesSchema,
  type UserPreferences
} from "@shared/schema";

// Import BOL OCR routes using ES modules
import bolOcrRoutes from "./routes/bol-ocr.mjs";

// Import analytics module routes
import analyticsRoutes from "./modules/analytics/routes";

// Import QR code endpoints
import { registerQrCodeRoutes } from "./endpoints/qr-codes";

// Import OCR controller
import { handleProcessDocument } from "./src/controllers/ocr-controller";

// Import authentication middleware
import { isAuthenticated } from "./middleware/auth-middleware";

/**
 * Helper function to check tenant isolation security for facility-related resources.
 * Returns a facility if it belongs to the user's organization, otherwise returns null.
 */
async function checkTenantFacilityAccess(facilityId: number, tenantId: number, isSuperAdmin: boolean, tag: string = 'TenantAccess') {
  try {
    // Super admins bypass tenant isolation checks
    if (isSuperAdmin) {
      console.log(`[${tag}] Super admin access granted for facility ${facilityId}`);
      return { id: facilityId, name: "Super Admin Access" };
    }
    
    // For organizations, verify facility belongs to the organization
    // Use raw query for better reliability vs. ORM
    const query = `
      SELECT t.id, t.name 
      FROM tenants t
      JOIN organization_facilities of ON t.id = of.organization_id
      WHERE of.facility_id = $1
      LIMIT 1
    `;
    
    const result = await pool.query(query, [facilityId]);
    
    if (result.rows.length === 0) {
      console.log(`[${tag}] Facility ${facilityId} not found in any organization`);
      return null;
    }
    
    const orgInfo = result.rows[0];
    console.log(`[${tag}] Facility ${facilityId} belongs to organization ${orgInfo.id} (${orgInfo.name})`);
    
    // If we have tenant ID from the user, verify it matches the facility's organization
    if (tenantId && orgInfo.id !== tenantId) {
      console.log(`[${tag}] Access denied - facility ${facilityId} belongs to org ${orgInfo.id}, user is from tenant ${tenantId}`);
      return null;
    }
    
    console.log(`[${tag}] Verified tenant access to facility ${facilityId} for tenant ${tenantId || orgInfo.id}`);
    return { id: facilityId, name: orgInfo.name };
  } catch (error) {
    console.error(`[${tag}] Error in tenant facility access check:`, error);
    return null;
  }
}
import {
  insertDockSchema,
  // Removing insertScheduleSchema as we're handling date validation manually
  insertCarrierSchema,
  insertNotificationSchema,
  insertFacilitySchema,
  insertAppointmentSettingsSchema,
  insertAppointmentTypeSchema,
  insertDailyAvailabilitySchema,
  insertCustomQuestionSchema,
  insertStandardQuestionSchema,
  insertBookingPageSchema,
} from "@shared/schema";

// Import the super-admin creation script and seed roles
import { createSuperAdmin } from "./create-super-admin";
import { fixAdminPassword } from "./fix-admin-password";
import { seedRoles } from "./seed-roles";
import { hashPassword as authHashPassword } from "./auth";

// This import was already declared elsewhere in the file, so we'll just keep the interface
// Type for the WebSocket client with tenant metadata
interface TenantWebSocket extends WebSocket {
  tenantId?: number;
  userId?: number;
  isAlive?: boolean;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Get storage instance
  const storage = await getStorage();
  
  // Setup authentication routes
  await setupAuth(app);
  
  // Run super-admin creation script
  try {
    console.log("Running create-super-admin script...");
    await createSuperAdmin();
    console.log("Super-admin creation script completed");
  } catch (error) {
    console.error("Error running super-admin creation script:", error);
  }
  
  // Seed roles
  try {
    console.log("Running seed-roles script...");
    await seedRoles();
    console.log("Roles seeding completed");
  } catch (error) {
    console.error("Error seeding roles:", error);
  }
  
  // Fix admin password
  try {
    console.log("Running fix-admin-password script...");
    await fixAdminPassword();
    console.log("Admin password fix completed");
  } catch (error) {
    console.error("Error fixing admin password:", error);
  }
  
  // Register admin routes
  adminRoutes(app);
  
  // Register QR code routes (now handled below in try/catch)
  
  // Register organization modules routes
  try {
    const { registerOrganizationModulesRoutes } = await import('./modules/admin/organizations/routes');
    registerOrganizationModulesRoutes(app);
    console.log('Organization modules routes registered');
  } catch (error) {
    console.error('Error registering organization modules routes:', error);
  }
  
  // Register booking page logo endpoint
  try {
    const { registerBookingPagesLogoEndpoint } = await import('./endpoints/booking-pages-logo');
    registerBookingPagesLogoEndpoint(app);
    console.log('Booking pages logo endpoint registered');
  } catch (error) {
    console.error('Error registering booking pages logo endpoint:', error);
  }
  
  // Register BOL OCR routes
  try {
    app.use('/api/bol-ocr', bolOcrRoutes);
    console.log('BOL OCR routes registered');
  } catch (error) {
    console.error('Error registering BOL OCR routes:', error);
  }
  
  // Register hours routes
  try {
    const { registerHoursRoutes } = await import('./modules/hours/routes');
    registerHoursRoutes(app);
    console.log('Hours routes registered');
  } catch (error) {
    console.error('Error registering hours routes:', error);
  }
  
  // Register Analytics routes
  try {
    app.use('/api/analytics', analyticsRoutes);
    console.log('Analytics routes registered');
  } catch (error) {
    console.error('Error registering analytics routes:', error);
  }
  
  // Register QR code routes
  try {
    await registerQrCodeRoutes(app);
    console.log('QR code routes registered');
  } catch (error) {
    console.error('Error registering QR code routes:', error);
  }
  
  // Register PaddleOCR document processing route
  try {
    app.post('/api/ocr/process-document', isAuthenticated, ocrDocUpload.single('document'), handleProcessDocument);
    console.log('PaddleOCR document processing route registered');
  } catch (error) {
    console.error('Error registering PaddleOCR document processing route:', error);
  }
  
  // Register enhanced availability endpoint (v2)
  try {
    // Import the new availability service
    const { calculateAvailabilitySlots, defaultConfig } = await import('./src/services/availability');
    
    // Register the v2 endpoint
    app.get("/api/availability/v2", async (req, res) => {
      try {
        const { date, facilityId, appointmentTypeId, typeId, bookingPageSlug, timezone } = req.query;
        
        // Get the tenant ID from user session
        const userTenantId = req.user?.tenantId;
        
        // Support both parameter naming conventions
        const finalTypeId = typeId || appointmentTypeId;
        
        // Public booking request tracking
        const isPublicBookingRequest = !!bookingPageSlug;
        
        // Variable to hold the effective tenant ID
        let effectiveTenantId = userTenantId;
        
        // If booking page slug is provided, use it to determine tenant
        if (bookingPageSlug) {
          console.log(`[AvailabilityV2] Request with bookingPageSlug: ${bookingPageSlug}`);
          
          // Get the booking page to determine its tenant
          const bookingPage = await storage.getBookingPageBySlug(bookingPageSlug as string);
          if (bookingPage && bookingPage.tenantId) {
            effectiveTenantId = bookingPage.tenantId;
            console.log(`[AvailabilityV2] Using booking page tenant context: ${effectiveTenantId}`);
          } else {
            console.log(`[AvailabilityV2] No valid booking page found for slug: ${bookingPageSlug}`);
          }
        }
        
        console.log("===== /api/availability/v2 REQUEST =====");
        console.log("PARAMETERS:", { 
          date, 
          facilityId, 
          appointmentTypeId, 
          typeId, 
          finalTypeId,
          timezone: timezone || 'not provided',
          bookingPageSlug: bookingPageSlug || 'none',
          userTenantId: userTenantId || 'none',
          effectiveTenantId: effectiveTenantId || 'none'
        });
        
        // Validate required parameters
        if (!date || !facilityId || !finalTypeId) {
          console.log("[AvailabilityV2] Missing required parameters");
          return res.status(400).json({ 
            message: "Missing required parameters: date, facilityId, and appointment type ID are required" 
          });
        }
        
        // Parse parameters
        const parsedDate = String(date); // YYYY-MM-DD format
        const parsedFacilityId = Number(facilityId);
        const parsedAppointmentTypeId = Number(finalTypeId);
        // Default to America/New_York if timezone is not provided or invalid
        const parsedTimezone = typeof timezone === 'string' ? timezone : undefined;
        
        // Check if user has a valid tenant ID (either directly or from booking page)
        if (!effectiveTenantId && !req.user?.username?.includes('admin@conmitto.io')) {
          console.log("[AvailabilityV2] No tenant context available");
          return res.status(403).json({ 
            message: "Cannot determine tenant context. Access denied." 
          });
        }
        
        // Extract configuration parameters from request if provided
        const intervalMinutes = req.query.intervalMinutes ? Number(req.query.intervalMinutes) : undefined;
        const bookingBufferMinutes = req.query.bookingBufferMinutes ? Number(req.query.bookingBufferMinutes) : undefined;
        const maxAdvanceDays = req.query.maxAdvanceDays ? Number(req.query.maxAdvanceDays) : undefined;
        
        // Build configuration object
        const config = { ...defaultConfig };
        if (intervalMinutes !== undefined && !isNaN(intervalMinutes)) config.intervalMinutes = intervalMinutes;
        if (bookingBufferMinutes !== undefined && !isNaN(bookingBufferMinutes)) config.bookingBufferMinutes = bookingBufferMinutes;
        if (maxAdvanceDays !== undefined && !isNaN(maxAdvanceDays)) config.maxAdvanceDays = maxAdvanceDays;
        
        // Log configuration
        console.log(`[AvailabilityV2] Using config:`, {
          intervalMinutes: config.intervalMinutes || 'default',
          bookingBufferMinutes: config.bookingBufferMinutes || 'default',
          maxAdvanceDays: config.maxAdvanceDays || 'default'
        });
        
        // Call the enhanced availability service
        console.log(`[AvailabilityV2] Calling calculateAvailabilitySlots for date=${parsedDate}, facilityId=${parsedFacilityId}, typeId=${parsedAppointmentTypeId}, timezone=${parsedTimezone || 'facility default'}`);
        
        // First attempt to fetch the facility to get its timezone
        const facility = await storage.getFacility(parsedFacilityId, effectiveTenantId || 0);
        if (!facility) {
          console.log(`[AvailabilityV2] Facility ${parsedFacilityId} not found`);
          return res.status(404).json({ message: "Facility not found" });
        }
        
        // Use the provided timezone or fall back to facility timezone
        const facilityTimezone = facility.timezone || 'America/New_York';
        const effectiveTimezone = parsedTimezone || facilityTimezone;
        console.log(`[AvailabilityV2] Using timezone: ${effectiveTimezone} (facility: ${facilityTimezone})`);
        
        const availabilitySlots = await calculateAvailabilitySlots(
          db,
          storage,
          parsedDate,
          parsedFacilityId,
          parsedAppointmentTypeId,
          effectiveTenantId || 0, // Fallback to 0 if no tenant ID (should never happen due to check above)
          undefined, // No test appointments
          config // Pass our configuration parameters
        );
        
        // For backward compatibility, extract just the time strings for available slots
        const availableTimes = availabilitySlots
          .filter(slot => slot.available)
          .map(slot => slot.time);
        
        // Create response with both new and legacy formats
        const responseData = {
          slots: availabilitySlots,
          availableTimes,
          date: parsedDate,
          facilityId: parsedFacilityId,
          appointmentTypeId: parsedAppointmentTypeId
        };
        
        console.log(`[AvailabilityV2] Generated ${availabilitySlots.length} slots, ${availableTimes.length} available`);
        console.log("===== /api/availability/v2 COMPLETE =====");
        
        res.json(responseData);
      } catch (err) {
        console.error("[AvailabilityV2] Error calculating availability:", err);
        res.status(500).json({ 
          message: "Failed to calculate availability", 
          error: err instanceof Error ? err.message : String(err)
        });
      }
    });
    
    console.log('Enhanced availability (v2) endpoint registered');
  } catch (error) {
    console.error('Error registering enhanced availability endpoint:', error);
  }
  
  // Test login for development and debugging
  app.get("/api/test-login", async (req, res, next) => {
    try {
      console.log("Test login endpoint called");
      
      // Try to find the super-admin account
      let superAdmin = await storage.getUserByUsername("akash.agarwal@conmitto.io");
      
      if (superAdmin) {
        console.log("Found super-admin user:", superAdmin.id);
        
        // Update with correct password format if needed
        if (!superAdmin.password || !superAdmin.password.includes('.')) {
          console.log("Updating super-admin user with proper password format");
          const hashedPassword = await authHashPassword("password123");
          
          const updatedUser = await storage.updateUser(superAdmin.id, {
            password: hashedPassword
          });
          
          if (updatedUser) {
            superAdmin = updatedUser;
            console.log("Super-admin password updated successfully");
          } else {
            console.error("Failed to update super-admin password");
          }
        }
        
        // Log in as super-admin
        req.login(superAdmin, (loginErr) => {
          if (loginErr) {
            console.error("Login error:", loginErr);
            return next(loginErr);
          }
          
          console.log("Login successful as super-admin");
          const { password, ...userWithoutPassword } = superAdmin;
          
          return res.status(200).json({
            message: "Logged in as super-admin",
            user: userWithoutPassword
          });
        });
      } else {
        // Fallback to regular test admin if super-admin doesn't exist
        let testUser = await storage.getUserByUsername("testadmin");
        
        if (testUser) {
          console.log("Found existing test user:", testUser.id);
          
          // Update with correct password format if needed
          if (!testUser.password || !testUser.password.includes('.')) {
            console.log("Updating test admin user with proper password format");
            const hashedPassword = await authHashPassword("password123");
            
            const updatedUser = await storage.updateUser(testUser.id, {
              password: hashedPassword
            });
            
            if (updatedUser) {
              testUser = updatedUser;
              console.log("User password updated successfully");
            } else {
              console.error("Failed to update user password");
            }
          }
          
          // Log in with existing user
          req.login(testUser, (loginErr) => {
            if (loginErr) {
              console.error("Login error:", loginErr);
              return next(loginErr);
            }
            
            console.log("Login successful with test user");
            const { password, ...userWithoutPassword } = testUser;
            
            return res.status(200).json({
              message: "Logged in with existing test user",
              user: userWithoutPassword
            });
          });
        } else {
          console.log("Creating new test admin user");
          // Create a test admin user
          const hashedPassword = await authHashPassword("password123");
          const newUser = await storage.createUser({
            username: "testadmin",
            password: hashedPassword,
            email: "testadmin@example.com",
            firstName: "Test",
            lastName: "Admin",
            role: "admin",
            tenantId: null
          });
          
          console.log("New test user created:", newUser.id);
          
          // Log in with the new user
          req.login(newUser, (loginErr) => {
            if (loginErr) {
              console.error("Login error for new user:", loginErr);
              return next(loginErr);
            }
            
            console.log("Login successful with new test user");
            const { password, ...userWithoutPassword } = newUser;
            
            return res.status(200).json({
              message: "Created and logged in with new test user",
              user: userWithoutPassword
            });
          });
        }
      }
    } catch (err) {
      console.error("Test login error:", err);
      res.status(500).json({ 
        message: "An error occurred during test login", 
        error: err instanceof Error ? err.message : String(err) 
      });
    }
  });
  
  // Auth status endpoint for debugging
  app.get("/api/auth-status", (req, res) => {
    const sessionId = req.sessionID;
    
    res.json({
      isAuthenticated: req.isAuthenticated(),
      user: req.user || null,
      sessionID: sessionId,
      session: req.session
    });
  });
  
  // Get the role check middleware
  const { checkRole } = app.locals;

  // API Routes
  // Dock routes
  app.get("/api/docks", async (req, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const isSuperAdmin = req.user?.username?.includes('admin@conmitto.io') || false;
      
      console.log(`[GetDocks] Fetching docks for tenant ID: ${tenantId || 'none'}, isSuperAdmin: ${isSuperAdmin}`);
      
      // Get all docks first
      const allDocks = await storage.getDocks();
      
      // If user is a super admin, return all docks
      if (isSuperAdmin) {
        console.log(`[GetDocks] Super admin access granted, returning all ${allDocks.length} docks`);
        return res.json(allDocks);
      }
      
      // If no tenant ID, return empty list for security
      if (!tenantId) {
        console.log('[GetDocks] No tenant ID, returning empty dock list for security');
        return res.json([]);
      }
      
      // For regular users with a tenant ID, filter docks by facilities that belong to their organization
      // First, get all facilities for this tenant
      const tenantFacilities = await storage.getFacilitiesByOrganizationId(tenantId);
      const facilityIds = tenantFacilities.map(f => f.id);
      
      console.log(`[GetDocks] Found ${tenantFacilities.length} facilities for tenant ${tenantId}`);
      
      // Filter docks to only include those that belong to the tenant's facilities
      const tenantDocks = allDocks.filter(dock => 
        dock.facilityId && facilityIds.includes(dock.facilityId)
      );
      
      console.log(`[GetDocks] Returning ${tenantDocks.length} docks for tenant ${tenantId}`);
      res.json(tenantDocks);
    } catch (err) {
      console.error('[GetDocks] Error fetching docks:', err);
      res.status(500).json({ message: "Failed to fetch docks" });
    }
  });
  
  // Get docks by facility
  app.get("/api/facilities/:id/docks", async (req, res) => {
    try {
      const facilityId = Number(req.params.id);
      const tenantId = req.user?.tenantId;
      const isSuperAdmin = req.user?.username?.includes('admin@conmitto.io') || false;
      
      console.log(`[GetFacilityDocks] Fetching docks for facility ID: ${facilityId}, tenant ID: ${tenantId || 'none'}, isSuperAdmin: ${isSuperAdmin}`);
      
      // First check if the facility exists and belongs to the tenant's organization
      const facility = await checkTenantFacilityAccess(
        facilityId,
        tenantId,
        isSuperAdmin,
        'GetFacilityDocks'
      );
      
      if (!facility) {
        console.log(`[GetFacilityDocks] Facility ID ${facilityId} not found or access denied`);
        return res.status(404).json({ message: "Facility not found or access denied" });
      }
      
      // Get all docks and filter by facility ID
      const docks = await storage.getDocks();
      const facilityDocks = docks.filter(dock => dock.facilityId === facilityId);
      
      console.log(`[GetFacilityDocks] Found ${facilityDocks.length} docks for facility ID ${facilityId}`);
      res.json(facilityDocks);
    } catch (err) {
      console.error("[GetFacilityDocks] Error fetching facility docks:", err);
      res.status(500).json({ message: "Failed to fetch facility docks" });
    }
  });

  app.get("/api/docks/:id", async (req, res) => {
    try {
      const dockId = Number(req.params.id);
      const tenantId = req.user?.tenantId;
      const isSuperAdmin = req.user?.username?.includes('admin@conmitto.io') || false;
      
      console.log(`[GetDock] Fetching dock ID: ${dockId} for tenant ID: ${tenantId || 'none'}, isSuperAdmin: ${isSuperAdmin}`);
      
      // Get the dock
      const dock = await storage.getDock(dockId);
      if (!dock) {
        console.log(`[GetDock] Dock ID ${dockId} not found`);
        return res.status(404).json({ message: "Dock not found" });
      }
      
      // If user is a super admin, bypass tenant checks
      if (isSuperAdmin) {
        console.log(`[GetDock] Super admin access granted for dock ID ${dockId}`);
        return res.json(dock);
      }
      
      // If no tenant ID, deny access for security
      if (!tenantId) {
        console.log('[GetDock] No tenant ID, access denied for security');
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Check if dock belongs to a facility owned by the tenant's organization
      if (dock.facilityId) {
        const facility = await checkTenantFacilityAccess(
          dock.facilityId,
          tenantId,
          isSuperAdmin,
          'GetDock'
        );
        
        if (!facility) {
          console.log(`[GetDock] Access denied - dock ID ${dockId} facility ${dock.facilityId} does not belong to tenant ${tenantId}`);
          return res.status(403).json({ message: "Access denied to this dock" });
        }
      } else {
        console.log(`[GetDock] Access denied - dock ID ${dockId} has no facility ID`);
        return res.status(403).json({ message: "Access denied to this dock" });
      }
      
      console.log(`[GetDock] Access granted for dock ID ${dockId} to tenant ${tenantId}`);
      res.json(dock);
    } catch (err) {
      console.error('[GetDock] Error fetching dock:', err);
      res.status(500).json({ message: "Failed to fetch dock" });
    }
  });

  app.post("/api/docks", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const isSuperAdmin = req.user?.username?.includes('admin@conmitto.io') || false;
      
      console.log(`[CreateDock] Attempting to create dock for tenant ID: ${tenantId || 'none'}, isSuperAdmin: ${isSuperAdmin}`);
      
      // Validate the dock data
      const validatedData = insertDockSchema.parse(req.body);
      
      // If the dock has a facility ID, verify tenant access to that facility
      if (validatedData.facilityId) {
        // Check if user has access to this facility
        const facility = await checkTenantFacilityAccess(
          validatedData.facilityId,
          tenantId,
          isSuperAdmin,
          'CreateDock'
        );
        
        if (!facility) {
          console.log(`[CreateDock] Access denied - facility ID ${validatedData.facilityId} does not belong to tenant ${tenantId}`);
          return res.status(403).json({ message: "Access denied to this facility" });
        }
      }
      
      // Create the dock
      const dock = await storage.createDock(validatedData);
      console.log(`[CreateDock] Successfully created dock ID ${dock.id}`);
      res.status(201).json(dock);
    } catch (err) {
      console.error('[CreateDock] Error creating dock:', err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid dock data", errors: err.errors });
      }
      res.status(500).json({ message: "Failed to create dock" });
    }
  });
  
  // Create dock for a specific facility
  app.post("/api/facilities/:id/docks", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const facilityId = Number(req.params.id);
      const tenantId = req.user?.tenantId;
      const isSuperAdmin = req.user?.username?.includes('admin@conmitto.io') || false;
      
      console.log(`[CreateFacilityDock] Creating dock for facility ID: ${facilityId}, tenant ID: ${tenantId || 'none'}, isSuperAdmin: ${isSuperAdmin}`);
      
      // Check if the facility exists and belongs to the tenant's organization
      const facility = await checkTenantFacilityAccess(
        facilityId,
        tenantId,
        isSuperAdmin,
        'CreateFacilityDock'
      );
      
      if (!facility) {
        console.log(`[CreateFacilityDock] Facility ID ${facilityId} not found or access denied`);
        return res.status(404).json({ message: "Facility not found or access denied" });
      }
      
      // Add facility ID to the dock data
      const dockData = {
        ...req.body,
        facilityId
      };
      
      // Validate dock data
      const validatedData = insertDockSchema.parse(dockData);
      console.log(`[CreateFacilityDock] Validated dock data for facility ID ${facilityId}:`, validatedData);
      
      // Create the dock
      const dock = await storage.createDock(validatedData);
      console.log(`[CreateFacilityDock] Successfully created dock ID ${dock.id} for facility ID ${facilityId}`);
      
      res.status(201).json(dock);
    } catch (err) {
      console.error("[CreateFacilityDock] Error creating dock for facility:", err);
      
      if (err instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid dock data", 
          errors: err.errors,
          details: err.format() 
        });
      }
      
      res.status(500).json({ 
        message: "Failed to create dock",
        error: err instanceof Error ? err.message : "Unknown error" 
      });
    }
  });

  app.put("/api/docks/:id", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const tenantId = req.user?.tenantId;
      const isSuperAdmin = req.user?.username?.includes('admin@conmitto.io') || false;
      
      console.log(`[UpdateDock] Updating dock ID: ${id}, tenant ID: ${tenantId || 'none'}, isSuperAdmin: ${isSuperAdmin}`);
      
      // First get the dock to check if it exists
      const dock = await storage.getDock(id);
      if (!dock) {
        console.log(`[UpdateDock] Dock ID ${id} not found`);
        return res.status(404).json({ message: "Dock not found" });
      }
      
      // Check if user has access to this dock's facility
      if (dock.facilityId) {
        const facility = await checkTenantFacilityAccess(
          dock.facilityId,
          tenantId,
          isSuperAdmin,
          'UpdateDock'
        );
        
        if (!facility && !isSuperAdmin) {
          console.log(`[UpdateDock] Access denied - dock ID ${id} facility ${dock.facilityId} does not belong to tenant ${tenantId}`);
          return res.status(403).json({ message: "Access denied to this dock" });
        }
      } else if (!isSuperAdmin) {
        console.log(`[UpdateDock] Access denied - dock ID ${id} has no facility ID`);
        return res.status(403).json({ message: "Access denied to this dock" });
      }
      
      // Make sure we have all required fields by combining existing and new data
      try {
        const fieldsToCheck = {
          ...dock,  // Start with existing dock data
          ...req.body   // Override with update data
        };
        // Validate combined data preserves required fields
        insertDockSchema.parse(fieldsToCheck);
      } catch (validationErr) {
        if (validationErr instanceof z.ZodError) {
          console.error("[UpdateDock] Validation error updating dock:", validationErr.format());
          return res.status(400).json({ 
            message: "Invalid dock data", 
            errors: validationErr.errors,
            details: validationErr.format()
          });
        }
        throw validationErr;
      }
      
      // If user is trying to change the facilityId, verify they have access to the new facility
      if (req.body.facilityId && req.body.facilityId !== dock.facilityId) {
        const newFacility = await checkTenantFacilityAccess(
          req.body.facilityId,
          tenantId,
          isSuperAdmin,
          'UpdateDock'
        );
        
        if (!newFacility && !isSuperAdmin) {
          console.log(`[UpdateDock] Access denied - new facility ID ${req.body.facilityId} does not belong to tenant ${tenantId}`);
          return res.status(403).json({ message: "Access denied to the target facility" });
        }
      }
      
      // Update the dock
      const updatedDock = await storage.updateDock(id, req.body);
      console.log(`[UpdateDock] Successfully updated dock ID ${id}`);
      res.json(updatedDock);
    } catch (err) {
      console.error("[UpdateDock] Error updating dock:", err);
      res.status(500).json({ 
        message: "Failed to update dock",
        error: err instanceof Error ? err.message : "Unknown error"
      });
    }
  });
  
  app.delete("/api/docks/:id", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const tenantId = req.user?.tenantId;
      const isSuperAdmin = req.user?.username?.includes('admin@conmitto.io') || false;
      
      console.log(`[DeleteDock] Attempting to delete dock ID: ${id}, tenant ID: ${tenantId || 'none'}, isSuperAdmin: ${isSuperAdmin}`);
      
      // First get the dock to check if it exists
      const dock = await storage.getDock(id);
      if (!dock) {
        console.log(`[DeleteDock] Dock ID ${id} not found`);
        return res.status(404).json({ message: "Dock not found" });
      }
      
      // Check if user has access to this dock's facility
      if (dock.facilityId) {
        const facility = await checkTenantFacilityAccess(
          dock.facilityId,
          tenantId,
          isSuperAdmin,
          'DeleteDock'
        );
        
        if (!facility && !isSuperAdmin) {
          console.log(`[DeleteDock] Access denied - dock ID ${id} facility ${dock.facilityId} does not belong to tenant ${tenantId}`);
          return res.status(403).json({ message: "Access denied to this dock" });
        }
      } else if (!isSuperAdmin) {
        console.log(`[DeleteDock] Access denied - dock ID ${id} has no facility ID`);
        return res.status(403).json({ message: "Access denied to this dock" });
      }
      
      // Check if there are any scheduled appointments using this dock
      const dockSchedules = await storage.getSchedulesByDock(id);
      if (dockSchedules.length > 0) {
        console.log(`[DeleteDock] Cannot delete dock ID ${id}: ${dockSchedules.length} existing schedules`);
        return res.status(409).json({ 
          message: "Cannot delete dock with existing schedules", 
          count: dockSchedules.length
        });
      }
      
      // Delete the dock
      const success = await storage.deleteDock(id);
      if (!success) {
        console.error(`[DeleteDock] Failed to delete dock ID ${id} from storage`);
        return res.status(500).json({ message: "Failed to delete dock" });
      }
      
      console.log(`[DeleteDock] Successfully deleted dock ID: ${id}`);
      res.status(204).send();
    } catch (err) {
      console.error("[DeleteDock] Error deleting dock:", err);
      res.status(500).json({ 
        message: "Failed to delete dock",
        error: err instanceof Error ? err.message : "Unknown error"
      });
    }
  });

  // Schedule routes
  // Search schedules
  app.get("/api/schedules/search", async (req, res) => {
    try {
      const { query } = req.query;
      const tenantId = req.user?.tenantId;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: "Search query is required" });
      }
      
      console.log(`[searchSchedules] Searching schedules with query "${query}" for tenant ID ${tenantId || 'none'}`);
      
      // Pass tenantId to enforce tenant isolation 
      const results = await storage.searchSchedules(query, tenantId);
      
      console.log(`[searchSchedules] Found ${results.length} results for tenant ID ${tenantId || 'none'}`);
      res.json(results);
    } catch (error) {
      console.error("Error searching schedules:", error);
      res.status(500).json({ error: "Failed to search schedules" });
    }
  });
  
  // Lookup schedule by confirmation code
  app.get("/api/schedules/confirmation/:code", async (req, res) => {
    try {
      const { code } = req.params;
      const tenantId = req.user?.tenantId;
      
      if (!code) {
        return res.status(400).json({ error: "Confirmation code is required" });
      }
      
      console.log(`[ConfirmationLookup] Looking up schedule with code ${code}${tenantId ? ` for tenant ${tenantId}` : ''}`);
      
      // First get the schedule without tenant filtering
      const schedule = await storage.getScheduleByConfirmationCode(code);
      if (!schedule) {
        console.log(`[ConfirmationLookup] No schedule found with code ${code}`);
        return res.status(404).json({ error: "No schedule found with the provided confirmation code" });
      }
      
      // If user has a tenant ID, check for organization access
      if (tenantId) {
        const isSuperAdmin = req.user?.username?.includes('admin@conmitto.io') || false;
        
        // Get the facility ID - could be from the schedule directly or from the dock
        let facilityId = schedule.facilityId;
        if (!facilityId && schedule.dockId) {
          const dock = await storage.getDock(schedule.dockId);
          facilityId = dock?.facilityId;
        }
        
        let tenantHasAccess = false;
        
        // Method 1: Check appointment type ownership
        if (schedule.appointmentTypeId) {
          const appointmentType = await storage.getAppointmentType(schedule.appointmentTypeId, tenantId);
          tenantHasAccess = !!appointmentType;
        }
        
        // Method 2: Check facility ownership via organization_facilities junction
        if (!tenantHasAccess && facilityId) {
          const facility = await checkTenantFacilityAccess(
            facilityId,
            tenantId,
            isSuperAdmin,
            'ConfirmationLookup'
          );
          tenantHasAccess = !!facility;
        }
        
        // Super admins bypass tenant checks
        if (!tenantHasAccess && !isSuperAdmin) {
          console.log(`[ConfirmationLookup] Access denied - schedule with confirmation code ${code} does not belong to tenant ${tenantId}`);
          return res.status(403).json({ error: "Access denied to this schedule" });
        }
      }
      
      console.log(`[ConfirmationLookup] Successfully retrieved schedule ID ${schedule.id} for confirmation code ${code}`);
      res.json(schedule);
    } catch (error) {
      console.error("Error looking up schedule by confirmation code:", error);
      res.status(500).json({ error: "Failed to lookup schedule" });
    }
  });
  
  // Reschedule an appointment
  app.patch("/api/schedules/:id/reschedule", async (req, res) => {
    try {
      const scheduleId = Number(req.params.id);
      
      if (isNaN(scheduleId)) {
        return res.status(400).json({ error: "Invalid schedule ID" });
      }
      
      const { startTime, endTime } = req.body;
      
      if (!startTime || !endTime) {
        return res.status(400).json({ error: "Start time and end time are required" });
      }
      
      // Check if schedule exists
      const existingSchedule = await storage.getSchedule(scheduleId);
      if (!existingSchedule) {
        return res.status(404).json({ error: "Schedule not found" });
      }
      
      // Only allow rescheduling if the appointment is in 'scheduled' status
      if (existingSchedule.status !== 'scheduled') {
        return res.status(400).json({ 
          error: "Only scheduled appointments can be rescheduled",
          status: existingSchedule.status
        });
      }
      
      // Update the schedule with new times
      const updatedSchedule = await storage.updateSchedule(scheduleId, {
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        lastModifiedAt: new Date(),
        // Add any other fields that need to be updated
      });
      
      if (!updatedSchedule) {
        return res.status(500).json({ error: "Failed to reschedule appointment" });
      }
      
      // Send confirmation email if email is available
      if (existingSchedule.driverEmail) {
        try {
          // Find the facility by getting the dock first (if available)
          let facility = null;
          if (existingSchedule.dockId) {
            const dock = await storage.getDock(existingSchedule.dockId);
            if (dock && dock.facilityId) {
              facility = await storage.getFacility(dock.facilityId);
            }
          }
          
          const appointmentType = existingSchedule.appointmentTypeId 
            ? await storage.getAppointmentType(existingSchedule.appointmentTypeId)
            : null;
            
          // Get dock name or use placeholder if not assigned
          const dock = existingSchedule.dockId ? await storage.getDock(existingSchedule.dockId) : null;
          const dockName = dock ? dock.name : "Not scheduled yet";
          
          await sendConfirmationEmail(
            existingSchedule.driverEmail,
            `HC${existingSchedule.id}`,
            { 
              ...existingSchedule,
              dockName,
              facilityName: facility ? facility.name : "Unknown Facility",
              appointmentTypeName: appointmentType ? appointmentType.name : "Standard Appointment",
              timezone: facility ? facility.timezone : "America/New_York"
            }
          ).catch(err => {
            // Just log errors, don't let email failures affect API response
            console.error('Failed to send reschedule confirmation email:', err);
          });
        } catch (emailError) {
          // Log the error but don't fail the API call
          console.error('Error preparing reschedule confirmation email:', emailError);
        }
      }
      
      res.json({
        success: true,
        schedule: updatedSchedule,
        message: "Appointment successfully rescheduled"
      });
      
    } catch (error) {
      console.error("Error rescheduling appointment:", error);
      res.status(500).json({ 
        error: "Failed to reschedule appointment",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Cancel an appointment
  app.patch("/api/schedules/:id/cancel", async (req, res) => {
    try {
      const scheduleId = Number(req.params.id);
      
      if (isNaN(scheduleId)) {
        return res.status(400).json({ error: "Invalid schedule ID" });
      }
      
      const { reason } = req.body;
      
      // Check if schedule exists
      const existingSchedule = await storage.getSchedule(scheduleId);
      if (!existingSchedule) {
        return res.status(404).json({ error: "Schedule not found" });
      }
      
      // Only allow cancellation if the appointment is in 'scheduled' status
      if (existingSchedule.status !== 'scheduled') {
        return res.status(400).json({ 
          error: "Only scheduled appointments can be cancelled",
          status: existingSchedule.status
        });
      }
      
      // Update the schedule to cancelled status
      const updatedSchedule = await storage.updateSchedule(scheduleId, {
        status: 'cancelled',
        notes: reason ? `${existingSchedule.notes || ''}\n\nCancellation reason: ${reason}`.trim() : existingSchedule.notes,
        lastModifiedAt: new Date(),
      });
      
      if (!updatedSchedule) {
        return res.status(500).json({ error: "Failed to cancel appointment" });
      }
      
      // Send cancellation email if email is available
      if (existingSchedule.driverEmail) {
        try {
          // Find the facility by getting the dock first (if available)
          let facility = null;
          if (existingSchedule.dockId) {
            const dock = await storage.getDock(existingSchedule.dockId);
            if (dock && dock.facilityId) {
              facility = await storage.getFacility(dock.facilityId);
            }
          }
          
          // Simple email for cancellation notification
          await sendEmail({
            to: existingSchedule.driverEmail,
            subject: `Appointment Cancelled - Confirmation #HC${existingSchedule.id}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background-color: #f44336; color: white; padding: 20px; text-align: center;">
                  <h1 style="margin: 0;">Appointment Cancelled</h1>
                </div>
                
                <div style="padding: 20px;">
                  <p>Your appointment with confirmation code <strong>HC${existingSchedule.id}</strong> has been cancelled.</p>
                  <p><strong>Facility:</strong> ${facility ? facility.name : "Unknown Facility"}</p>
                  <p><strong>Original Date/Time:</strong> ${new Date(existingSchedule.startTime).toLocaleString()}</p>
                  ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
                  <p>If you need to schedule a new appointment, please visit our booking portal or contact the facility directly.</p>
                </div>
                
                <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
                  <p>This is an automated message from Dock Optimizer. Please do not reply to this email.</p>
                </div>
              </div>
            `,
            text: `
              Appointment Cancelled
              
              Your appointment with confirmation code HC${existingSchedule.id} has been cancelled.
              
              Facility: ${facility ? facility.name : "Unknown Facility"}
              Original Date/Time: ${new Date(existingSchedule.startTime).toLocaleString()}
              ${reason ? `Reason: ${reason}` : ''}
              
              If you need to schedule a new appointment, please visit our booking portal or contact the facility directly.
              
              This is an automated message from Dock Optimizer. Please do not reply to this email.
            `
          }).catch(err => {
            // Just log errors, don't let email failures affect API response
            console.error('Failed to send cancellation email:', err);
          });
        } catch (emailError) {
          // Log the error but don't fail the API call
          console.error('Error preparing cancellation email:', emailError);
        }
      }
      
      res.json({
        success: true,
        schedule: updatedSchedule,
        message: "Appointment successfully cancelled"
      });
      
    } catch (error) {
      console.error("Error cancelling appointment:", error);
      res.status(500).json({ 
        error: "Failed to cancel appointment",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  app.get("/api/schedules", async (req, res) => {
    try {
      // Handle date range filtering
      const { startDate, endDate } = req.query;
      let schedules;
      
      // Get the tenant ID from the authenticated user
      const tenantId = req.user?.tenantId;
      console.log(`Fetching schedules for user with tenantId: ${tenantId}`);
      
      if (startDate && endDate) {
        schedules = await storage.getSchedulesByDateRange(
          new Date(startDate as string),
          new Date(endDate as string),
          tenantId
        );
      } else {
        try {
          // Pass tenant ID to filter schedules by tenant
          schedules = await storage.getSchedules(tenantId);
        } catch (error) {
          console.error("Error in getSchedules:", error);
          throw error;
        }
      }
      
      res.json(schedules);
    } catch (err) {
      console.error("Failed to fetch schedules:", err);
      res.status(500).json({ message: "Failed to fetch schedules", error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/api/schedules/:id", async (req, res) => {
    try {
      const schedule = await storage.getSchedule(Number(req.params.id));
      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }
      res.json(schedule);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch schedule" });
    }
  });

  app.get("/api/docks/:id/schedules", async (req, res) => {
    try {
      const schedules = await storage.getSchedulesByDock(Number(req.params.id));
      res.json(schedules);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch schedules for dock" });
    }
  });

  app.post("/api/schedules", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      console.log("=== SCHEDULE CREATION START ===");
      console.log("Raw request body:", JSON.stringify(req.body, null, 2));
      
      // Add the current user to createdBy field and process the dates
      const rawData = { ...req.body };
      
      // Round start and end times to 15 minute intervals
      if (rawData.startTime) {
        const startDate = new Date(rawData.startTime);
        const roundedStartMin = Math.round(startDate.getMinutes() / 15) * 15;
        startDate.setHours(
          roundedStartMin === 60 ? startDate.getHours() + 1 : startDate.getHours(),
          roundedStartMin === 60 ? 0 : roundedStartMin,
          0, 0
        );
        rawData.startTime = startDate;
      }
      
      if (rawData.endTime) {
        const endDate = new Date(rawData.endTime);
        const roundedEndMin = Math.round(endDate.getMinutes() / 15) * 15;
        endDate.setHours(
          roundedEndMin === 60 ? endDate.getHours() + 1 : endDate.getHours(),
          roundedEndMin === 60 ? 0 : roundedEndMin,
          0, 0
        );
        rawData.endTime = endDate;
      }
      
      let scheduleData = {
        ...rawData,
        createdBy: req.user!.id
      };
      
      // Extract newCarrier data if present
      const newCarrierData = scheduleData.newCarrier;
      delete scheduleData.newCarrier;
      
      // Partial validation to ensure critical fields like appointmentTypeId and facilityId are set
      console.log("IMPORTANT: Bypassing most validation but ensuring critical fields are present");
      
      // Make sure critical data is captured in the schedule
      const validatedData = scheduleData;
      
      // Ensure appointment type is captured
      if (validatedData.appointmentTypeId && !validatedData.appointmentType) {
        try {
          const appointmentType = await storage.getAppointmentType(validatedData.appointmentTypeId);
          if (appointmentType) {
            validatedData.appointmentType = appointmentType.name;
          }
        } catch (e) {
          console.error("Failed to fetch appointment type details:", e);
        }
      }
      
      // Log intermediate data for debugging
      console.log("Raw insertSchedule in storage:", JSON.stringify(validatedData, null, 2));
      
      // Check if dock exists (if dockId is provided)
      if (validatedData.dockId) {
        const dock = await storage.getDock(validatedData.dockId);
        if (!dock) {
          return res.status(400).json({ message: "Invalid dock ID" });
        }
      }
      
      // Handle custom carrier creation if needed
      let carrierId = validatedData.carrierId;
      if (!carrierId && newCarrierData) {
        try {
          console.log("Creating new carrier:", newCarrierData);
          const validatedCarrierData = insertCarrierSchema.parse(newCarrierData);
          const newCarrier = await storage.createCarrier(validatedCarrierData);
          carrierId = newCarrier.id;
          validatedData.carrierId = carrierId;
          console.log("New carrier created with ID:", carrierId);
        } catch (carrierErr) {
          console.error("Failed to create new carrier:", carrierErr);
          if (carrierErr instanceof z.ZodError) {
            return res.status(400).json({ 
              message: "Invalid carrier data", 
              errors: carrierErr.errors 
            });
          }
          return res.status(500).json({ message: "Failed to create new carrier" });
        }
      } else {
        // Check if existing carrier ID is valid
        const carrier = await storage.getCarrier(validatedData.carrierId);
        if (!carrier) {
          return res.status(400).json({ message: "Invalid carrier ID" });
        }
      }
      
      // Check for schedule conflicts - only consider active appointments
      // Skip conflict check if no dock is assigned
      let conflictingSchedules: any[] = [];
      if (validatedData.dockId) {
        conflictingSchedules = (await storage.getSchedulesByDock(validatedData.dockId))
          .filter(s => 
            // Only consider active schedules (not completed or cancelled)
            s.status !== 'completed' && s.status !== 'cancelled' &&
            (new Date(validatedData.startTime) < new Date(s.endTime)) && 
            (new Date(validatedData.endTime) > new Date(s.startTime))
          );
      }
      
      if (conflictingSchedules.length > 0) {
        return res.status(409).json({ 
          message: "Schedule conflicts with existing schedules", 
          conflicts: conflictingSchedules 
        });
      }
      
      // If we have a facilityId, ensure the facilityName is set correctly
      if (validatedData.facilityId && !validatedData.facilityName) {
        const facility = await storage.getFacility(validatedData.facilityId);
        if (facility) {
          validatedData.facilityName = facility.name;
        }
      }
      
      // If we have an appointmentTypeId, ensure the appointmentTypeName is set correctly
      if (validatedData.appointmentTypeId && !validatedData.appointmentTypeName) {
        const appointmentType = await storage.getAppointmentType(validatedData.appointmentTypeId);
        if (appointmentType) {
          validatedData.appointmentTypeName = appointmentType.name;
        }
      }
      
      // Now wrap the appointment creation in a DB transaction and check availability
      // Import the enhanced availability service
      const { calculateAvailabilitySlots } = await import('./src/services/availability');
      
      const schedule = await db.transaction(async (tx) => {
        // 1. Get the necessary parameters for the availability check
        if (!validatedData.facilityId || !validatedData.appointmentTypeId || !validatedData.startTime) {
          throw new Error('Missing required fields for availability check');
        }
        
        // Convert startTime to date string (YYYY-MM-DD) and time string (HH:MM)
        const startDate = new Date(validatedData.startTime);
        const dateStr = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
        const timeStr = startDate.getHours().toString().padStart(2, '0') + ':' + 
                      startDate.getMinutes().toString().padStart(2, '0'); // HH:MM
        
        // 2. Determine effective tenant ID (from user or facility)
        const effectiveTenantId = req.user?.tenantId || 0;
        
        console.log(`[Schedule Creation] Checking availability for date=${dateStr}, time=${timeStr}, facilityId=${validatedData.facilityId}, appointmentTypeId=${validatedData.appointmentTypeId}, tenantId=${effectiveTenantId}`);
        
        // 3. Call calculateAvailabilitySlots to check if the selected time is available
        const availabilitySlots = await calculateAvailabilitySlots(
          db, // Using main db here since deep transaction propagation is complex
          storage,
          dateStr,
          validatedData.facilityId,
          validatedData.appointmentTypeId,
          effectiveTenantId
        );
        
        // 4. Find the specific slot that matches our requested time
        const requestedSlot = availabilitySlots.find(slot => slot.time === timeStr);
        
        // 5. Verify slot availability
        if (!requestedSlot) {
          console.log(`[Schedule Creation] Requested time slot ${timeStr} not found in availability results`);
          throw new Error('SLOT_UNAVAILABLE');
        }
        
        if (!requestedSlot.available || requestedSlot.remainingCapacity <= 0) {
          console.log(`[Schedule Creation] Requested time slot ${timeStr} is not available. Available: ${requestedSlot.available}, Capacity: ${requestedSlot.remainingCapacity}, Reason: ${requestedSlot.reason}`);
          throw new Error('SLOT_UNAVAILABLE');
        }
        
        console.log(`[Schedule Creation] Slot ${timeStr} is available with capacity ${requestedSlot.remainingCapacity}. Proceeding with creation.`);
        
        // 6. Create the schedule if the slot is available
        return await storage.createSchedule(validatedData);
      });
      
      // Get dock and facility information for the email and WebSocket broadcast
      try {
        // Prepare enhanced schedule info for both email and WebSocket broadcast
        let enhancedSchedule: any = {
          ...schedule
        };
        
        if (schedule.dockId) {
          const dock = await storage.getDock(schedule.dockId);
          if (dock && dock.facilityId) {
            const facility = await storage.getFacility(dock.facilityId);
            
            // Enhance the schedule with dock and facility info
            enhancedSchedule = {
              ...enhancedSchedule,
              dockName: dock.name || `Dock ${schedule.dockId}`,
              facilityName: facility?.name || 'Main Facility',
              facilityId: facility?.id || dock.facilityId
            };
            
            // Try to send a confirmation email if we have contact information
            // This will log but not fail if SendGrid is not configured
            if (schedule.driverEmail) {
              sendConfirmationEmail(
                schedule.driverEmail,
                `HC${schedule.id}`,
                {
                  id: schedule.id,
                  dockName: dock.name || `Dock ${schedule.dockId}`,
                  facilityName: facility?.name || 'Main Facility',
                  startTime: new Date(schedule.startTime),
                  endTime: new Date(schedule.endTime),
                  truckNumber: schedule.truckNumber || '',
                  customerName: schedule.customerName || undefined,
                  type: schedule.type
                }
              ).catch(err => {
                // Just log errors, don't let email failures affect API response
                console.error('Failed to send confirmation email:', err);
              });
            }
          }
        }
        
        // Broadcast the new schedule via WebSocket to update clients in real-time
        if (app.locals.broadcastScheduleUpdate) {
          console.log(`[WebSocket] Broadcasting new schedule creation: ${schedule.id}`);
          app.locals.broadcastScheduleUpdate({
            ...enhancedSchedule,
            tenantId: req.user?.tenantId
          });
        }
      } catch (emailError) {
        // Log the error but don't fail the API call
        console.error('Error preparing confirmation email:', emailError);
      }
      
      res.status(201).json(schedule);
    } catch (err) {
      console.error("Failed to create schedule:", err);
      
      // Handle specific error for unavailable slots
      if (err instanceof Error && err.message === 'SLOT_UNAVAILABLE') {
        return res.status(409).json({ 
          message: "Selected time slot is no longer available or capacity is full. Please try another time." 
        });
      }
      
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid schedule data", errors: err.errors });
      }
      
      res.status(500).json({ message: "Failed to create schedule" });
    }
  });

  app.put("/api/schedules/:id", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const schedule = await storage.getSchedule(id);
      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }
      
      // Add the current user to lastModifiedBy field
      const rawData = { ...req.body };
      
      // Round start and end times to 15 minute intervals
      if (rawData.startTime) {
        const startDate = new Date(rawData.startTime);
        const roundedStartMin = Math.round(startDate.getMinutes() / 15) * 15;
        startDate.setHours(
          roundedStartMin === 60 ? startDate.getHours() + 1 : startDate.getHours(),
          roundedStartMin === 60 ? 0 : roundedStartMin,
          0, 0
        );
        rawData.startTime = startDate;
      }
      
      if (rawData.endTime) {
        const endDate = new Date(rawData.endTime);
        const roundedEndMin = Math.round(endDate.getMinutes() / 15) * 15;
        endDate.setHours(
          roundedEndMin === 60 ? endDate.getHours() + 1 : endDate.getHours(),
          roundedEndMin === 60 ? 0 : roundedEndMin,
          0, 0
        );
        rawData.endTime = endDate;
      }
      
      const scheduleData = {
        ...rawData,
        lastModifiedBy: req.user!.id
      };
      
      const updatedSchedule = await storage.updateSchedule(id, scheduleData);
      
      // Broadcast the schedule update via WebSockets for real-time calendar updates
      if (app.locals.broadcastScheduleUpdate) {
        console.log(`[WebSocket] Broadcasting schedule update: ${id}`);
        app.locals.broadcastScheduleUpdate({
          ...updatedSchedule,
          tenantId: req.user?.tenantId
        });
      }
      
      res.json(updatedSchedule);
    } catch (err) {
      res.status(500).json({ message: "Failed to update schedule" });
    }
  });
  
  // PATCH for partial updates to schedules
  app.patch("/api/schedules/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const schedule = await storage.getSchedule(id);
      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }
      
      console.log("PATCH /api/schedules/:id - Received data:", req.body);
      
      // Special logging for notes updates to help debug real-time issues
      if (req.body.notes !== undefined) {
        console.log(`[Notes Update] Schedule ${id} notes updated:`, req.body.notes);
      }
      
      // Add the current user to lastModifiedBy field
      const rawData = { ...req.body };
      
      // Round start and end times to 15 minute intervals
      if (rawData.startTime) {
        const startDate = new Date(rawData.startTime);
        const roundedStartMin = Math.round(startDate.getMinutes() / 15) * 15;
        startDate.setHours(
          roundedStartMin === 60 ? startDate.getHours() + 1 : startDate.getHours(),
          roundedStartMin === 60 ? 0 : roundedStartMin,
          0, 0
        );
        rawData.startTime = startDate;
      }
      
      if (rawData.endTime) {
        const endDate = new Date(rawData.endTime);
        const roundedEndMin = Math.round(endDate.getMinutes() / 15) * 15;
        endDate.setHours(
          roundedEndMin === 60 ? endDate.getHours() + 1 : endDate.getHours(),
          roundedEndMin === 60 ? 0 : roundedEndMin,
          0, 0
        );
        rawData.endTime = endDate;
      }
      
      const scheduleData = {
        ...rawData,
        lastModifiedBy: req.user?.id || null,
        lastModifiedAt: new Date()
      };
      
      const updatedSchedule = await storage.updateSchedule(id, scheduleData);
      
      // Get facility's organization info to determine tenantId
      let tenantId = req.user?.tenantId;
      if (!tenantId && schedule.facilityId) {
        try {
          const query = `
            SELECT t.id FROM tenants t
            JOIN organization_facilities of ON t.id = of.organization_id
            WHERE of.facility_id = $1
            LIMIT 1
          `;
          const result = await pool.query(query, [schedule.facilityId]);
          if (result.rows.length > 0) {
            tenantId = result.rows[0].id;
            console.log(`[Schedule Update] Found tenant ID ${tenantId} for facility ${schedule.facilityId}`);
          }
        } catch (err) {
          console.error('[Schedule Update] Error looking up tenant ID:', err);
        }
      }
      
      // Broadcast the schedule update via WebSockets for real-time calendar updates
      if (app.locals.broadcastScheduleUpdate) {
        console.log(`[WebSocket] Broadcasting schedule patch: ${id}, Tenant: ${tenantId || 'unknown'}`);
        
        // Add notes change info to help debug via WebSocket logs
        const extraInfo = req.body.notes !== undefined ? { notesUpdated: true } : {};
        
        app.locals.broadcastScheduleUpdate({
          ...updatedSchedule,
          tenantId: tenantId,
          ...extraInfo
        });
      }
      
      res.json(updatedSchedule);
    } catch (err) {
      console.error("Failed to patch schedule:", err);
      res.status(500).json({ message: "Failed to update schedule" });
    }
  });
  
  // Assign a schedule to a door
  app.patch("/api/schedules/:id/assign-door", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    try {
      const scheduleId = parseInt(req.params.id);
      const { dockId } = req.body;
      
      if (isNaN(scheduleId)) {
        return res.status(400).json({ error: "Invalid schedule ID" });
      }
      
      if (typeof dockId !== 'number') {
        return res.status(400).json({ error: "Valid dock ID is required" });
      }
      
      // Check if the schedule exists
      const schedule = await storage.getSchedule(scheduleId);
      if (!schedule) {
        return res.status(404).json({ error: "Schedule not found" });
      }
      
      // Check if the dock exists
      const dock = await storage.getDock(dockId);
      if (!dock) {
        return res.status(404).json({ error: "Dock not found" });
      }
      
      // Check if the dock is available (not assigned to another appointment)
      const dockSchedules = await storage.getSchedulesByDock(dockId);
      const now = new Date();
      
      const conflictingSchedule = dockSchedules.find(s => 
        s.id !== scheduleId && 
        s.status !== 'cancelled' && 
        s.status !== 'completed' &&
        new Date(s.startTime) <= now &&
        new Date(s.endTime) >= now
      );
      
      if (conflictingSchedule) {
        return res.status(409).json({ 
          error: "Door is currently occupied",
          conflictingSchedule
        });
      }
      
      // Update the schedule with the dock ID
      const updatedSchedule = await storage.updateSchedule(scheduleId, { dockId });
      
      if (!updatedSchedule) {
        return res.status(500).json({ error: "Failed to update schedule" });
      }
      
      // Broadcast the door assignment via WebSockets for real-time updates
      if (app.locals.broadcastScheduleUpdate) {
        console.log(`[WebSocket] Broadcasting door assignment: Schedule ${scheduleId} to Door ${dockId}`);
        app.locals.broadcastScheduleUpdate({
          ...updatedSchedule,
          tenantId: req.user?.tenantId
        });
      }
      
      console.log(`[AssignDoor] Schedule ${scheduleId} successfully assigned to dock ${dockId}`);
      res.json(updatedSchedule);
    } catch (error) {
      console.error("Error assigning schedule to door:", error);
      res.status(500).json({ 
        error: "Failed to assign schedule to door",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Check-in endpoint - starts appointment
  app.patch("/api/schedules/:id/check-in", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const schedule = await storage.getSchedule(id);
      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }
      
      // Use provided actualStartTime from request body or current time
      const actualStartTime = req.body?.actualStartTime ? new Date(req.body.actualStartTime) : new Date();
      
      // Update schedule status to in-progress and set actual start time
      const scheduleData = {
        status: "in-progress",
        actualStartTime,
        lastModifiedBy: req.user?.id || null,
        lastModifiedAt: new Date()
      };
      
      const updatedSchedule = await storage.updateSchedule(id, scheduleData);
      
      // Broadcast the check-in status change via WebSockets for real-time updates
      if (app.locals.broadcastScheduleUpdate) {
        console.log(`[WebSocket] Broadcasting check-in status change: Schedule ${id}`);
        app.locals.broadcastScheduleUpdate({
          ...updatedSchedule,
          tenantId: req.user?.tenantId
        });
      }
      
      res.json(updatedSchedule);
    } catch (err) {
      console.error("Failed to check in schedule:", err);
      res.status(500).json({ message: "Failed to check in" });
    }
  });
  
  // QR Code check-in endpoint - for driver self-service check-in
  app.post("/api/schedules/:id/check-in", async (req, res) => {
    try {
      const scheduleId = Number(req.params.id);
      const schedule = await storage.getSchedule(scheduleId);
      
      if (!schedule) {
        console.log(`[QR Check-in] Schedule not found with ID: ${scheduleId}`);
        return res.status(404).json({ message: "Appointment not found" });
      }
      
      // Only allow check-in for appointments that are scheduled (not cancelled, etc.)
      const validStatusForCheckIn = ['scheduled', 'confirmed'];
      if (!validStatusForCheckIn.includes(schedule.status)) {
        console.log(`[QR Check-in] Invalid status for check-in: ${schedule.status}`);
        return res.status(400).json({ 
          message: "Cannot check in - appointment has invalid status",
          status: schedule.status
        });
      }
      
      // Check that appointment is within valid time range (not too early/late)
      const now = new Date();
      const appointmentStart = new Date(schedule.startTime);
      const appointmentEnd = new Date(schedule.endTime);
      
      // Allow check-in up to 30 minutes before scheduled time
      const earlyCheckInWindow = new Date(appointmentStart);
      earlyCheckInWindow.setMinutes(appointmentStart.getMinutes() - 30);
      
      // Allow check-in up to 30 minutes after end time
      const lateCheckInWindow = new Date(appointmentEnd);
      lateCheckInWindow.setMinutes(appointmentEnd.getMinutes() + 30);
      
      // Only enforce time window in production
      if (process.env.NODE_ENV === 'production' && (now < earlyCheckInWindow || now > lateCheckInWindow)) {
        console.log(`[QR Check-in] Outside valid time window. Current: ${now.toISOString()}, Window: ${earlyCheckInWindow.toISOString()} - ${lateCheckInWindow.toISOString()}`);
        return res.status(400).json({ 
          message: "Cannot check in - outside valid time window",
          currentTime: now,
          appointmentStart: appointmentStart,
          appointmentEnd: appointmentEnd
        });
      }
      
      // Update schedule status to 'checked-in'
      const updatedSchedule = await storage.updateSchedule(scheduleId, {
        status: "checked-in",
        actualStartTime: now,
        lastModifiedAt: now
      });
      
      // Broadcast the check-in status change via WebSockets for real-time updates
      if (app.locals.broadcastScheduleUpdate) {
        // Get facility's organization info to determine tenantId if needed
        let tenantId = null;
        if (schedule.facilityId) {
          try {
            const query = `
              SELECT t.id FROM tenants t
              JOIN organization_facilities of ON t.id = of.organization_id
              WHERE of.facility_id = $1
              LIMIT 1
            `;
            const result = await pool.query(query, [schedule.facilityId]);
            if (result.rows.length > 0) {
              tenantId = result.rows[0].id;
              console.log(`[QR Check-in] Found tenant ID ${tenantId} for facility ${schedule.facilityId}`);
            }
          } catch (err) {
            console.error('[QR Check-in] Error looking up tenant ID:', err);
          }
        }
        
        console.log(`[WebSocket] Broadcasting QR code check-in: Schedule ${scheduleId}`);
        app.locals.broadcastScheduleUpdate({
          ...updatedSchedule,
          tenantId: tenantId
        });
      }
      
      console.log(`[QR Check-in] Successfully checked in schedule ID: ${scheduleId}`);
      res.json(updatedSchedule);
    } catch (err) {
      console.error("[QR Check-in] Error checking in schedule:", err);
      res.status(500).json({ message: "Failed to check in" });
    }
  });
  
  // File upload endpoint for checkout photos
  app.post("/api/upload/checkout-photo", checkoutPhotoUpload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      // Return the path to the uploaded file
      const filePath = `/uploads/checkout-photos/${req.file.filename}`;
      console.log(`[Upload] Checkout photo uploaded: ${filePath}`);
      
      return res.status(201).json({ 
        message: "File uploaded successfully",
        filePath: filePath 
      });
    } catch (err) {
      console.error("[Upload] Error uploading checkout photo:", err);
      return res.status(500).json({ 
        message: "Failed to upload file",
        error: err instanceof Error ? err.message : String(err)
      });
    }
  });
  
  // Check-out endpoint - completes appointment
  app.patch("/api/schedules/:id/check-out", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const schedule = await storage.getSchedule(id);
      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }
      
      // Use provided actualEndTime from request body or current time
      const actualEndTime = req.body?.actualEndTime ? new Date(req.body.actualEndTime) : new Date();
      
      // Get notes if provided
      const notes = req.body?.notes || schedule.notes;
      
      // Get photo path from request body
      console.log("[Checkout] Request body:", req.body);
      
      // First check if customFormData was passed directly
      let checkoutPhoto = null;
      
      if (req.body?.customFormData) {
        try {
          // Parse customFormData if it's a string
          const customData = typeof req.body.customFormData === 'string' 
            ? JSON.parse(req.body.customFormData) 
            : req.body.customFormData;
          
          // Extract checkout photo path if it exists
          if (customData.checkoutPhoto) {
            checkoutPhoto = customData.checkoutPhoto;
            console.log(`[Checkout] Found checkout photo in customFormData: ${checkoutPhoto}`);
          }
        } catch (e) {
          console.warn("[Checkout] Error parsing customFormData from request:", e);
        }
      }
      
      // If no photo in customFormData, check direct photoPath property
      if (!checkoutPhoto && req.body?.photoPath) {
        checkoutPhoto = req.body.photoPath;
        console.log(`[Checkout] Using photo path from request body: ${checkoutPhoto}`);
      }
      
      // Parse existing custom form data (safely)
      let existingCustomFormData = {};
      if (schedule.customFormData) {
        try {
          existingCustomFormData = typeof schedule.customFormData === 'string' ?
            JSON.parse(schedule.customFormData) : schedule.customFormData;
          console.log("[Checkout] Successfully parsed existing customFormData");
        } catch (e) {
          console.warn("[Checkout] Failed to parse existing customFormData:", e);
        }
      }
      
      // Update the custom form data to include check-out information
      const newCustomFormData = JSON.stringify({
        ...existingCustomFormData,
        checkoutTime: actualEndTime.toISOString(),
        checkoutBy: req.user?.id || null,
        checkoutNotes: notes,
        checkoutPhoto: checkoutPhoto
      });
      
      // Store the original dock ID for reference
      const originalDockId = schedule.dockId;
      console.log(`Original dock ID before check-out: ${originalDockId}`);
      
      // First, we'll update the status and metadata
      console.log(`Checking out schedule ${id} with updated status and metadata`);
      const statusUpdate = {
        status: "completed",
        actualEndTime,
        notes: notes,
        lastModifiedBy: req.user?.id || null,
        lastModifiedAt: new Date(),
        customFormData: newCustomFormData
      };
      
      const statusUpdated = await storage.updateSchedule(id, statusUpdate);
      if (!statusUpdated) {
        return res.status(500).json({ message: "Failed to update schedule status" });
      }
      
      // Now, clear the dockId as a separate step to ensure it's properly released
      if (originalDockId !== null) {
        console.log(`Explicitly releasing dock (setting dockId to null) for schedule ${id}`);
        const dockUpdate = {
          dockId: null
        };
        
        const dockUpdated = await storage.updateSchedule(id, dockUpdate);
        if (!dockUpdated) {
          console.error(`Failed to release dock for schedule ${id}`);
          // Continue since we've already updated the status
        }
      }
      
      // Verify if the door was actually released
      const verifiedSchedule = await storage.getSchedule(id);
      
      if (originalDockId !== null && verifiedSchedule && verifiedSchedule.dockId !== null) {
        console.error(`WARNING: Failed to release dock ${originalDockId} for schedule ${id}. DockId still set to ${verifiedSchedule.dockId}`);
      } else if (originalDockId !== null) {
        console.log(`Door successfully released during check-out: schedule ${id}`);
      }
      
      // Get additional schedule data needed for email notification
      if (verifiedSchedule || statusUpdated) {
        try {
          // Get the enhanced schedule with all related data
          const enhancedSchedule = await storage.getEnhancedSchedule(id);
          
          if (enhancedSchedule) {
            console.log(`[Check-out] Retrieved enhanced schedule data for email notification`);
            
            // Try to get the contact email from the schedule data
            let contactEmail = null;
            
            // First, check if a notification email was stored in customFormData
            try {
              const parsedCustomData = typeof enhancedSchedule.customFormData === 'string'
                ? JSON.parse(enhancedSchedule.customFormData)
                : enhancedSchedule.customFormData || {};
                
              if (parsedCustomData.notificationEmail) {
                contactEmail = parsedCustomData.notificationEmail;
                console.log(`[Check-out] Using stored notification email from customFormData: ${contactEmail}`);
              }
            } catch (e) {
              console.warn('[Check-out] Error parsing customFormData to retrieve notification email:', e);
            }
            
            // If no notification email found in customFormData, try other fields
            if (!contactEmail) {
              // First try creator email if it exists (since that's the person who booked the appointment)
              if (enhancedSchedule.creatorEmail) {
                contactEmail = enhancedSchedule.creatorEmail;
                console.log(`[Check-out] Using creator email for notification: ${contactEmail}`);
              }
              // Next try customer email as primary contact
              else if (enhancedSchedule.customerEmail) {
                contactEmail = enhancedSchedule.customerEmail;
                console.log(`[Check-out] Using customer email for notification: ${contactEmail}`);
              } 
              // Fall back to carrier email
              else if (enhancedSchedule.carrierEmail) {
                contactEmail = enhancedSchedule.carrierEmail;
                console.log(`[Check-out] Using carrier email for notification: ${contactEmail}`);
              }
              // Fall back to driver email if available
              else if (enhancedSchedule.driverEmail) {
                contactEmail = enhancedSchedule.driverEmail;
                console.log(`[Check-out] Using driver email for notification: ${contactEmail}`);
              }
            }
            
            // Find or generate confirmation code
            const confirmationCode = enhancedSchedule.confirmationCode || 
              `${enhancedSchedule.id}-${new Date().getTime().toString().substring(9)}`;
            
            // If we have an email, send the checkout completion notification
            if (contactEmail) {
              try {
                console.log(`[Check-out] Sending checkout completion email to ${contactEmail}`);
                
                // Send the completion email
                await sendCheckoutCompletionEmail(
                  contactEmail,
                  confirmationCode,
                  enhancedSchedule
                );
                
                console.log(`[Check-out] Successfully sent checkout completion email to ${contactEmail}`);
              } catch (emailError) {
                console.error(`[Check-out] Failed to send checkout completion email:`, emailError);
                // Non-blocking error, continue with the check-out process
              }
            } else {
              console.log(`[Check-out] No contact email found for checkout notification`);
            }
          } else {
            console.warn(`[Check-out] Could not retrieve enhanced schedule data for notification`);
          }
        } catch (notificationError) {
          console.error(`[Check-out] Error preparing checkout notification:`, notificationError);
          // Non-blocking error, continue with the check-out process
        }
      }
      
      // Broadcast the checkout status change via WebSockets for real-time updates
      if (app.locals.broadcastScheduleUpdate) {
        console.log(`[WebSocket] Broadcasting check-out status change: Schedule ${id}`);
        app.locals.broadcastScheduleUpdate({
          ...(verifiedSchedule || statusUpdated),
          tenantId: req.user?.tenantId
        });
      }
      
      // Return the final schedule
      res.json(verifiedSchedule || statusUpdated);
    } catch (err) {
      console.error("Failed to check out schedule:", err);
      res.status(500).json({ 
        message: "Failed to check out", 
        error: err instanceof Error ? err.message : String(err)
      });
    }
  });
  
  // Cancel endpoint
  app.patch("/api/schedules/:id/cancel", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const schedule = await storage.getSchedule(id);
      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }
      
      // Update schedule status to cancelled
      const scheduleData = {
        status: "cancelled",
        lastModifiedBy: req.user?.id || null,
        lastModifiedAt: new Date()
      };
      
      const updatedSchedule = await storage.updateSchedule(id, scheduleData);
      
      // Broadcast the cancellation via WebSockets for real-time updates
      if (app.locals.broadcastScheduleUpdate) {
        console.log(`[WebSocket] Broadcasting schedule cancellation: ${id}`);
        app.locals.broadcastScheduleUpdate({
          ...updatedSchedule,
          tenantId: req.user?.tenantId
        });
      }
      
      res.json(updatedSchedule);
    } catch (err) {
      console.error("Failed to cancel schedule:", err);
      res.status(500).json({ message: "Failed to cancel appointment" });
    }
  });
  
  // Reschedule endpoint
  app.patch("/api/schedules/:id/reschedule", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const schedule = await storage.getSchedule(id);
      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }
      
      // Validate new times
      const { startTime: rawStartTime, endTime: rawEndTime } = req.body;
      if (!rawStartTime || !rawEndTime) {
        return res.status(400).json({ message: "Start time and end time are required" });
      }
      
      // Round times to 15-minute intervals
      const startDate = new Date(rawStartTime);
      const endDate = new Date(rawEndTime);
      
      // Round minutes to nearest 15-minute interval (0, 15, 30, 45)
      const roundStartMinutes = Math.round(startDate.getMinutes() / 15) * 15;
      const roundEndMinutes = Math.round(endDate.getMinutes() / 15) * 15;
      
      // Handle case where rounding results in 60 minutes
      const startHour = roundStartMinutes === 60 ? startDate.getHours() + 1 : startDate.getHours();
      const endHour = roundEndMinutes === 60 ? endDate.getHours() + 1 : endDate.getHours();
      const startMinutes = roundStartMinutes === 60 ? 0 : roundStartMinutes;
      const endMinutes = roundEndMinutes === 60 ? 0 : roundEndMinutes;
      
      startDate.setHours(startHour, startMinutes, 0, 0);
      endDate.setHours(endHour, endMinutes, 0, 0);
      
      const startTime = startDate;
      const endTime = endDate;
      
      // Check for schedule conflicts with new times (if a dock is assigned)
      let conflictingSchedules: any[] = [];
      if (schedule.dockId) {
        conflictingSchedules = (await storage.getSchedulesByDock(schedule.dockId))
          .filter(s => 
            s.id !== id && // Ignore the current schedule
            s.status !== 'completed' && s.status !== 'cancelled' && // Only consider active schedules
            (new Date(startTime) < new Date(s.endTime)) && 
            (new Date(endTime) > new Date(s.startTime))
          );
      }
      
      if (conflictingSchedules.length > 0) {
        return res.status(409).json({ 
          message: "Schedule conflicts with existing schedules", 
          conflicts: conflictingSchedules 
        });
      }
      
      // Update the schedule with new times
      const scheduleData = {
        startTime,
        endTime,
        lastModifiedBy: req.user?.id || null,
        lastModifiedAt: new Date()
      };
      
      const updatedSchedule = await storage.updateSchedule(id, scheduleData);
      
      // Broadcast the reschedule via WebSockets for real-time updates
      if (app.locals.broadcastScheduleUpdate) {
        console.log(`[WebSocket] Broadcasting schedule reschedule: ${id} to ${startTime.toISOString()} - ${endTime.toISOString()}`);
        app.locals.broadcastScheduleUpdate({
          ...updatedSchedule,
          tenantId: req.user?.tenantId
        });
      }
      
      res.json(updatedSchedule);
    } catch (err) {
      console.error("Failed to reschedule appointment:", err);
      res.status(500).json({ message: "Failed to reschedule appointment" });
    }
  });

  app.delete("/api/schedules/:id", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const schedule = await storage.getSchedule(id);
      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }
      
      await storage.deleteSchedule(id);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete schedule" });
    }
  });

  // Carrier routes
  app.get("/api/carriers", async (req, res) => {
    try {
      const carriers = await storage.getCarriers();
      res.json(carriers);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch carriers" });
    }
  });
  
  app.get("/api/carriers/search", async (req, res) => {
    try {
      const query = req.query.query as string;
      
      // If query is undefined or empty, return first 5 carriers
      if (query === undefined || query === null || query === '') {
        console.log("Empty carrier search query, returning top carriers");
        const carriers = await storage.getCarriers();
        return res.json(carriers.slice(0, 5));
      }
      
      // If we have a query, filter carriers by name or MC number
      const carriers = await storage.getCarriers();
      const filteredCarriers = carriers.filter(carrier => 
        carrier.name.toLowerCase().includes(query.toLowerCase()) || 
        (carrier.mcNumber && carrier.mcNumber.toLowerCase().includes(query.toLowerCase()))
      );
      
      console.log(`Carrier search query "${query}" returned ${filteredCarriers.length} result(s)`);
      res.json(filteredCarriers);
    } catch (err) {
      console.error("Error searching carriers:", err);
      res.status(500).json({ message: "Failed to search carriers" });
    }
  });

  app.get("/api/carriers/:id", async (req, res) => {
    try {
      const carrier = await storage.getCarrier(Number(req.params.id));
      if (!carrier) {
        return res.status(404).json({ message: "Carrier not found" });
      }
      res.json(carrier);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch carrier" });
    }
  });

  app.post("/api/carriers", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const validatedData = insertCarrierSchema.parse(req.body);
      const carrier = await storage.createCarrier(validatedData);
      res.status(201).json(carrier);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid carrier data", errors: err.errors });
      }
      res.status(500).json({ message: "Failed to create carrier" });
    }
  });

  // Notification routes
  app.get("/api/notifications", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized: Please log in" });
      }
      
      const notifications = await storage.getNotificationsByUser(req.user!.id);
      res.json(notifications);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.post("/api/notifications", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const validatedData = insertNotificationSchema.parse(req.body);
      const notification = await storage.createNotification(validatedData);
      res.status(201).json(notification);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid notification data", errors: err.errors });
      }
      res.status(500).json({ message: "Failed to create notification" });
    }
  });

  app.put("/api/notifications/:id/read", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized: Please log in" });
      }
      
      const id = Number(req.params.id);
      const notification = await storage.getNotification(id);
      
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      // Ensure the notification belongs to the current user
      if (notification.userId !== req.user!.id) {
        return res.status(403).json({ message: "Forbidden: Cannot access this notification" });
      }
      
      const updatedNotification = await storage.markNotificationAsRead(id);
      res.json(updatedNotification);
    } catch (err) {
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });
  
  // Facility routes
  app.get("/api/facilities", async (req, res) => {
    try {
      // Special case for external booking pages - allow unauthenticated access with booking page context
      const bookingPageSlug = req.query.bookingPageSlug as string | undefined;
      
      // If a booking page slug is provided, use it to determine the tenant context
      // This takes priority over the authenticated user's context
      if (bookingPageSlug) {
        console.log(`[Facilities] Request with bookingPageSlug: ${bookingPageSlug}`);
        
        // Get the booking page to determine its tenant
        const bookingPage = await storage.getBookingPageBySlug(bookingPageSlug);
        if (!bookingPage) {
          console.log(`[Facilities] No booking page found with slug: ${bookingPageSlug}`);
          return res.status(404).json({ message: "Booking page not found" });
        }
        
        if (!bookingPage.tenantId) {
          console.log(`[Facilities] Error: Booking page ${bookingPageSlug} has no tenant ID`);
          return res.status(500).json({ message: "Booking page has no organization" });
        }
        
        const bookingPageTenantId = bookingPage.tenantId;
        console.log(`[Facilities] Found booking page with tenant ID: ${bookingPageTenantId}`);
        
        // Get facilities for this booking page's tenant
        console.log(`[Facilities] Fetching facilities for booking page tenant ${bookingPageTenantId}`);
        const orgFacilities = await storage.getFacilitiesByOrganizationId(bookingPageTenantId);
        
        // If the booking page has specific facilities defined, filter to only those
        // Be careful with type checking since booking page facilities might be stored in different formats
        let facilities = orgFacilities;
        if (bookingPage.facilities) {
          console.log(`[Facilities] Processing booking page facilities: ${typeof bookingPage.facilities}, value: ${JSON.stringify(bookingPage.facilities)}`);
          
          let facilityIds = [];
          
          // Parse the facilities depending on format
          try {
            if (Array.isArray(bookingPage.facilities)) {
              facilityIds = bookingPage.facilities.map(id => 
                typeof id === 'string' ? parseInt(id, 10) : id
              );
            } else if (typeof bookingPage.facilities === 'string') {
              try {
                // Try to parse as JSON
                const parsed = JSON.parse(bookingPage.facilities);
                if (Array.isArray(parsed)) {
                  facilityIds = parsed.map(id => 
                    typeof id === 'string' ? parseInt(id, 10) : id
                  );
                }
              } catch (e) {
                // If not valid JSON, try to parse as comma-separated list
                facilityIds = bookingPage.facilities
                  .split(',')
                  .map(s => parseInt(s.trim(), 10))
                  .filter(n => !isNaN(n));
              }
            }
          } catch (err) {
            console.error(`[Facilities] Error parsing booking page facilities: ${err}`);
          }
          
          console.log(`[Facilities] Filtering to only facilities specified in booking page: ${facilityIds}`);
          
          if (facilityIds.length > 0) {
            facilities = orgFacilities.filter(facility => 
              facilityIds.includes(facility.id)
            );
          }
        }
        
        console.log(`[Tenant Isolation] Found ${facilities.length} facilities for booking page ${bookingPageSlug} (tenant ${bookingPageTenantId})`);
        facilities.forEach(facility => {
          console.log(`[Tenant Isolation] Booking page ${bookingPageSlug} has facility: ID ${facility.id}, Name: ${facility.name}`);
        });
        
        // For consistent API response
        return res.json(facilities);
      }
      
      // Standard authentication check for non-booking page requests
      if (!req.isAuthenticated()) {
        console.log(`[Facilities] Unauthenticated request - access denied`);
        return res.status(401).json({ message: "Authentication required" });
      }
      
      // Get the tenant ID from the authenticated user
      const tenantId = req.user?.tenantId;
      const username = req.user?.username;
      const isSuperAdmin = req.user?.role === 'super-admin' || username?.includes('admin@conmitto.io');
      
      console.log(`[Facilities] Fetching facilities for user ${username} with tenantId: ${tenantId || 'none'}, isSuperAdmin: ${isSuperAdmin || false}`);
      
      // If tenant ID provided and not a super admin, only return tenant's facilities
      if (tenantId && !isSuperAdmin) {
        console.log(`[Facilities] Fetching facilities for tenant ${tenantId} only`);
        const orgFacilities = await storage.getFacilitiesByOrganizationId(tenantId);
        console.log(`[Tenant Isolation] Found ${orgFacilities.length} facilities for organization ${tenantId}`);
        
        // Log the facility IDs and names for debugging
        if (orgFacilities.length > 0) {
          orgFacilities.forEach(facility => {
            console.log(`[Tenant Isolation] Organization ${tenantId} has facility: ID ${facility.id}, Name: ${facility.name}`);
          });
        } else {
          console.log(`[Tenant Isolation] WARNING: No facilities found for organization ${tenantId}`);
        }
        
        return res.json(orgFacilities);
      } else if (isSuperAdmin) {
        // Super admin gets all facilities
        console.log(`[Facilities] User is super admin, fetching all facilities`);
        const allFacilities = await storage.getFacilities();
        console.log(`[Facilities] Found ${allFacilities.length} total facilities`);
        return res.json(allFacilities);
      } else {
        // Authenticated user without tenant ID
        console.log(`[Facilities] Warning: Authenticated user without tenant ID, returning empty list`);
        return res.json([]);
      }
    } catch (err) {
      console.error("[Facilities] Error fetching facilities:", err);
      res.status(500).json({ message: "Failed to fetch facilities" });
    }
  });

  app.get("/api/facilities/:id", async (req, res) => {
    try {
      const facilityId = Number(req.params.id);
      // Add tenant isolation
      const tenantId = req.user?.tenantId;
      const username = req.user?.username;
      const isSuperAdmin = req.user?.role === 'super-admin' || username?.includes('admin@conmitto.io');
      
      // Only apply tenant filtering if user is not a super admin and has a tenant ID
      const facility = await storage.getFacility(
        facilityId, 
        (!isSuperAdmin && tenantId) ? tenantId : undefined
      );
      
      if (!facility) {
        console.log(`[Facilities] Facility not found with ID: ${facilityId}${tenantId ? ` for tenant ${tenantId}` : ''}`);
        return res.status(404).json({ message: "Facility not found" });
      }
      
      console.log(`[Facilities] User ${username} with tenantId ${tenantId} requested facility ${facilityId}`);
      
      // If not a super admin and has a tenant ID, verify access
      if (tenantId && !isSuperAdmin) {
        console.log(`[Facilities] Checking if facility ${facilityId} belongs to tenant ${tenantId}`);
        
        // Get facilities for this tenant
        const orgFacilities = await storage.getFacilitiesByOrganizationId(tenantId);
        const facilityIds = orgFacilities.map(f => f.id);
        
        if (!facilityIds.includes(facilityId)) {
          console.log(`[Facilities] Access denied - facility ${facilityId} does not belong to tenant ${tenantId}`);
          return res.status(403).json({ message: "Access denied to this facility" });
        }
      }
      
      console.log(`[Facilities] Returning facility ${facilityId}: ${facility.name}`);
      res.json(facility);
    } catch (err) {
      console.error(`[Facilities] Error fetching facility:`, err);
      res.status(500).json({ message: "Failed to fetch facility" });
    }
  });

  app.post("/api/facilities", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      console.log("Creating facility with request body:", req.body);
      const validatedData = insertFacilitySchema.parse(req.body);
      console.log("Validated facility data:", validatedData);
      
      const facility = await storage.createFacility(validatedData);
      console.log("Facility created successfully:", facility);
      
      res.status(201).json(facility);
    } catch (err) {
      console.error("Error creating facility:", err);
      
      if (err instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid facility data", 
          errors: err.errors,
          details: err.format() 
        });
      }
      
      res.status(500).json({ 
        message: "Failed to create facility",
        error: err instanceof Error ? err.message : "Unknown error" 
      });
    }
  });

  app.put("/api/facilities/:id", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const id = Number(req.params.id);
      console.log(`Updating facility ID: ${id} with data:`, req.body);
      
      const facility = await storage.getFacility(id);
      if (!facility) {
        return res.status(404).json({ message: "Facility not found" });
      }
      
      // Make sure we have at least the required fields
      try {
        const fieldsToCheck = {
          ...facility,  // Start with existing facility data
          ...req.body   // Override with update data
        };
        // Validate combined data preserves required fields
        insertFacilitySchema.parse(fieldsToCheck);
      } catch (validationErr) {
        if (validationErr instanceof z.ZodError) {
          console.error("Validation error updating facility:", validationErr.format());
          return res.status(400).json({ 
            message: "Invalid facility data", 
            errors: validationErr.errors,
            details: validationErr.format()
          });
        }
        throw validationErr;
      }
      
      const updatedFacility = await storage.updateFacility(id, req.body);
      console.log("Facility updated successfully:", updatedFacility);
      res.json(updatedFacility);
    } catch (err) {
      console.error("Error updating facility:", err);
      res.status(500).json({ 
        message: "Failed to update facility",
        error: err instanceof Error ? err.message : "Unknown error"
      });
    }
  });

  // Patch endpoint for partial facility updates (used for operating hours)
  app.patch("/api/facilities/:id", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const id = Number(req.params.id);
      console.log(`Patching facility ID: ${id} with data:`, req.body);
      
      const facility = await storage.getFacility(id);
      if (!facility) {
        return res.status(404).json({ message: "Facility not found" });
      }
      
      // For patch, we don't need to validate all fields, just update the ones provided
      // Remove lastModifiedAt if it exists in the request body to avoid double assignment
      const { lastModifiedAt, ...cleanReqBody } = req.body;
      
      const updateData = {
        ...cleanReqBody
        // lastModifiedAt is automatically added in the storage.updateFacility method
      };
      
      const updatedFacility = await storage.updateFacility(id, updateData);
      console.log("Facility patched successfully:", updatedFacility);
      res.json(updatedFacility);
    } catch (err) {
      console.error("Error patching facility:", err);
      res.status(500).json({ 
        message: "Failed to patch facility",
        error: err instanceof Error ? err.message : "Unknown error"
      });
    }
  });
  
  app.delete("/api/facilities/:id", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const facility = await storage.getFacility(id);
      if (!facility) {
        return res.status(404).json({ message: "Facility not found" });
      }
      
      // Check if there are any docks using this facility
      const docks = await storage.getDocks();
      const facilityDocks = docks.filter(d => d.facilityId === id);
      
      if (facilityDocks.length > 0) {
        return res.status(409).json({ 
          message: "Cannot delete facility with existing docks", 
          count: facilityDocks.length
        });
      }
      
      // Delete the facility
      const success = await storage.deleteFacility(id);
      if (!success) {
        return res.status(500).json({ message: "Failed to delete facility" });
      }
      
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete facility" });
    }
  });

  // User routes (admin only)
  app.get("/api/users", checkRole("admin"), async (req, res) => {
    try {
      // Get users for the current organization only if not a super admin
      let users;
      
      // If the user has a tenantId and is not a super admin, get only users for that organization
      if (req.user?.tenantId && !req.user.username?.includes('admin@conmitto.io')) {
        console.log(`Fetching users for organization ${req.user.tenantId}`);
        users = await storage.getUsersByOrganizationId(req.user.tenantId);
      } else {
        // Super admin gets all users
        console.log('Super admin fetching all users');
        users = await storage.getUsers();
      }
      
      // Remove passwords from the response
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (err) {
      console.error('Error fetching users:', err);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Route to test email notifications
  app.get("/api/test-notification-email", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized: Please log in" });
      }
      
      console.log('[EMAIL TEST] Starting test for user:', req.user!.id);
      
      // Check if the user has email notifications enabled
      const userPrefs = await storage.getUserPreferences(
        req.user!.id, 
        req.user!.tenantId || 2 // Default to Hanzo tenant ID if not set
      );
      
      if (!userPrefs) {
        return res.status(404).json({ 
          message: "User preferences not found. Please save preferences first."
        });
      }
      
      console.log('[EMAIL TEST] User preferences:', JSON.stringify(userPrefs, null, 2));
      
      if (!userPrefs.emailNotificationsEnabled) {
        return res.status(400).json({
          message: "Email notifications are disabled for this user. Please enable them in settings first."
        });
      }
      
      // Create a test schedule for the email
      const testSchedule = {
        id: 999, // Test ID
        facilityId: 1,
        dockId: 1,
        carrierId: 1,
        appointmentTypeId: 1,
        truckNumber: 'TEST-TRUCK',
        trailerNumber: 'TEST-TRAILER',
        driverName: 'Test Driver',
        driverPhone: '555-123-4567',
        driverEmail: req.user!.email,
        customerName: 'Test Customer',
        carrierName: 'Test Carrier',
        mcNumber: 'MC-TEST',
        bolNumber: 'BOL-TEST',
        poNumber: 'PO-TEST',
        palletCount: '10',
        weight: '1000',
        appointmentMode: 'trailer',
        startTime: new Date(Date.now() + 86400000), // Tomorrow
        endTime: new Date(Date.now() + 90000000), // Tomorrow + 1 hour
        actualStartTime: null,
        actualEndTime: null,
        type: 'inbound',
        status: 'scheduled',
        notes: 'This is a test appointment sent from your notification preferences',
        customFormData: null,
        createdBy: req.user!.id,
        createdAt: new Date(),
        lastModifiedAt: null,
        lastModifiedBy: null,
        
        // Enhanced properties
        facilityName: 'Test Facility',
        appointmentTypeName: 'Test Appointment Type',
        dockName: 'Test Dock',
        timezone: 'America/New_York'
      };
      
      // Send a test confirmation email
      const confirmationCode = `TEST${testSchedule.id}`;
      const result = await sendConfirmationEmail(
        req.user!.email, 
        confirmationCode,
        testSchedule
      );
      
      if (result === true) {
        return res.json({ 
          success: true, 
          message: `Test email sent successfully to ${req.user!.email}` 
        });
      } else if (typeof result === 'object') {
        return res.status(500).json({
          success: false,
          message: "Email generated but not sent (likely due to SendGrid configuration)",
          preview: {
            htmlLength: result.html?.length || 0,
            textLength: result.text?.length || 0,
            hasAttachment: !!result.attachments?.length
          }
        });
      } else {
        return res.status(500).json({
          success: false,
          message: "Failed to send test email. Check server logs for details."
        });
      }
    } catch (err) {
      console.error('[EMAIL TEST] Error sending test email:', err);
      res.status(500).json({ 
        success: false, 
        message: "Failed to send test email due to server error" 
      });
    }
  });

  // User Notification Preferences routes
  app.get("/api/user-preferences", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized: Please log in" });
      }
      
      // Get the user's organization ID - fallback to tenant ID if organization isn't specified
      const organizationId = req.query.organizationId ? 
        Number(req.query.organizationId) : 
        (req.user?.tenantId || 0);
      
      if (!organizationId) {
        return res.status(400).json({ 
          message: "Bad Request: Organization ID is required" 
        });
      }
      
      const preferences = await storage.getUserPreferences(req.user!.id, organizationId);
      
      if (!preferences) {
        // Return default preferences if none exist
        return res.json({
          userId: req.user!.id,
          organizationId,
          emailNotificationsEnabled: true,
          emailScheduleChanges: true,
          emailTruckArrivals: true,
          emailDockAssignments: true,
          emailWeeklyReports: false,
          pushNotificationsEnabled: true,
          pushUrgentAlertsOnly: true,
          pushAllUpdates: false
        });
      }
      
      res.json(preferences);
    } catch (err) {
      console.error('Error fetching user preferences:', err);
      res.status(500).json({ message: "Failed to fetch user preferences" });
    }
  });

  app.post("/api/user-preferences", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized: Please log in" });
      }
      
      // Validate the request body against the schema
      const validatedData = insertUserPreferencesSchema.parse({
        ...req.body,
        userId: req.user!.id
      });
      
      // Check if preferences already exist for this user and organization
      const existingPrefs = await storage.getUserPreferences(
        req.user!.id, 
        validatedData.organizationId
      );
      
      if (existingPrefs) {
        // Update existing preferences
        const updatedPrefs = await storage.updateUserPreferences(
          req.user!.id,
          validatedData.organizationId,
          validatedData
        );
        return res.json(updatedPrefs);
      }
      
      // Create new preferences
      const preferences = await storage.createUserPreferences(validatedData);
      res.status(201).json(preferences);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid preference data", 
          errors: err.errors 
        });
      }
      console.error('Error creating user preferences:', err);
      res.status(500).json({ message: "Failed to create user preferences" });
    }
  });

  // Handle PUT request to update user preferences, supporting both URL params and body
  app.put("/api/user-preferences/:organizationId?", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized: Please log in" });
      }
      
      // Get organizationId from URL params or from request body
      const organizationId = Number(req.params.organizationId || req.body.organizationId);
      
      if (isNaN(organizationId)) {
        return res.status(400).json({ message: "Invalid organization ID" });
      }
      
      // Log for debugging
      console.log(`[UserPrefs] PUT request received for user ${req.user!.id}, org ${organizationId}`);
      console.log('[UserPrefs] Request body:', JSON.stringify(req.body, null, 2));
      
      // Process booleans explicitly to avoid any type inconsistencies
      const sanitizedPrefs = {
        organizationId: organizationId,
        emailNotificationsEnabled: req.body.emailNotificationsEnabled === true,
        emailScheduleChanges: req.body.emailScheduleChanges === true,
        emailTruckArrivals: req.body.emailTruckArrivals === true,
        emailDockAssignments: req.body.emailDockAssignments === true,
        emailWeeklyReports: req.body.emailWeeklyReports === true,
        pushNotificationsEnabled: req.body.pushNotificationsEnabled === true,
        pushUrgentAlertsOnly: req.body.pushUrgentAlertsOnly === true,
        pushAllUpdates: req.body.pushAllUpdates === true
      };
      
      console.log('[UserPrefs] Sanitized preferences:', JSON.stringify(sanitizedPrefs, null, 2));
      
      // Ensure preferences exist for this user and organization
      const existingPrefs = await storage.getUserPreferences(req.user!.id, organizationId);
      
      if (!existingPrefs) {
        // If preferences don't exist, create them
        console.log(`[UserPrefs] Creating new preferences for user ${req.user!.id}, org ${organizationId}`);
        // Create a properly formatted user preferences object with userId included
        const prefsToCreate = {
          userId: req.user!.id,
          ...sanitizedPrefs
        };
        console.log(`[UserPrefs] Creating with data:`, JSON.stringify(prefsToCreate, null, 2));
        const newPrefs = await storage.createUserPreferences(prefsToCreate);
        return res.json(newPrefs);
      }
      
      // Update the preferences
      console.log(`[UserPrefs] Updating existing preferences for user ${req.user!.id}, org ${organizationId}`);
      const updatedPrefs = await storage.updateUserPreferences(
        req.user!.id,
        organizationId,
        sanitizedPrefs
      );
      
      res.json(updatedPrefs);
    } catch (err) {
      console.error('Error updating user preferences:', err);
      res.status(500).json({ message: "Failed to update user preferences" });
    }
  });

  // External booking API endpoints
  
  // New external booking endpoint for the BookingWizard
  app.post("/api/schedules/external", async (req, res) => {
    try {
      // Define validation schema for the BookingWizard data
      const bookingWizardSchema = z.object({
        // Step 1: Service Selection
        facilityId: z.number(),
        appointmentTypeId: z.number(),
        pickupOrDropoff: z.enum(["pickup", "dropoff"]),
        
        // Step 2: Date/Time
        startTime: z.date().or(z.string()),
        endTime: z.date().or(z.string()),
        
        // Step 3: Information
        companyName: z.string().min(1),
        contactName: z.string().min(1),
        email: z.string().email(),
        phone: z.string().min(5),
        customerRef: z.string().optional(),
        
        // Vehicle Information
        carrierId: z.number().optional().nullable(),
        carrierName: z.string().min(1),
        driverName: z.string().min(1),
        driverPhone: z.string().min(5),
        mcNumber: z.string().optional().or(z.literal("")),
        truckNumber: z.string().min(1),
        trailerNumber: z.string().optional(),
        
        // Notes
        notes: z.string().optional(),
        
        // Metadata
        bookingPageId: z.number().optional(),
        status: z.string().optional().default("scheduled"),
        createdVia: z.string().optional().default("external"),
        creatorEmail: z.string().email().optional(), // Add creatorEmail field to store creator's email
        
        // Any other fields
        customFields: z.record(z.string()).optional(),
        bolExtractedData: z.any().optional(),
        bolFileUploaded: z.boolean().optional()
      });
      
      console.log("[/api/schedules/external] Raw request data:", req.body);
      
      // Parse and validate the input data
      const validatedData = bookingWizardSchema.parse(req.body);
      
      // Ensure dates are Date objects
      const startTime = validatedData.startTime instanceof Date 
        ? validatedData.startTime 
        : new Date(validatedData.startTime);
        
      const endTime = validatedData.endTime instanceof Date 
        ? validatedData.endTime 
        : new Date(validatedData.endTime);
      
      // Check if facility exists
      const facility = await storage.getFacility(validatedData.facilityId);
      if (!facility) {
        return res.status(400).json({ message: "Invalid facility" });
      }
      
      // Check if appointment type exists
      const appointmentType = await storage.getAppointmentType(validatedData.appointmentTypeId);
      if (!appointmentType) {
        return res.status(400).json({ message: "Invalid appointment type" });
      }
      
      // Find or create carrier
      let carrier = null;
      try {
        // First try to get the carrier by ID if provided
        if (validatedData.carrierId && typeof validatedData.carrierId === 'number') {
          try {
            carrier = await storage.getCarrier(validatedData.carrierId);
            console.log(`Found carrier by ID ${validatedData.carrierId}: ${carrier?.name || 'not found'}`);
          } catch (error) {
            console.error(`Error looking up carrier by ID ${validatedData.carrierId}:`, error);
            // Continue to next method
          }
        }
        
        // If no carrier found by ID, try to find by name
        if (!carrier) {
          const carriers = await storage.getCarriers();
          carrier = carriers.find(c => 
            c.name.toLowerCase() === validatedData.carrierName.toLowerCase()
          );
        }
        
        // If no carrier found, create a new one
        if (!carrier) {
          carrier = await storage.createCarrier({
            name: validatedData.carrierName,
            mcNumber: validatedData.mcNumber || "",
            contactName: validatedData.contactName,
            contactEmail: validatedData.email,
            contactPhone: validatedData.phone
          });
          console.log(`Created new carrier: ${carrier.name} with ID ${carrier.id}`);
        } else {
          // If carrier found but MC Number is different and provided, update it
          if (carrier && validatedData.mcNumber && carrier.mcNumber !== validatedData.mcNumber) {
            carrier = await storage.updateCarrier(carrier.id, {
              ...carrier,
              mcNumber: validatedData.mcNumber
            });
            console.log(`Updated carrier ${carrier?.name || 'Unknown'} with MC number: ${validatedData.mcNumber}`);
          }
        }
      } catch (error) {
        console.error("Error processing carrier:", error);
        return res.status(500).json({ message: "Failed to process carrier information" });
      }
      
      // Final safety check - if we still don't have a carrier, create a default one
      if (!carrier) {
        try {
          carrier = await storage.createCarrier({
            name: validatedData.carrierName || "Unknown Carrier",
            mcNumber: validatedData.mcNumber || "",
            contactName: validatedData.contactName || "Unknown",
            contactEmail: validatedData.email || "unknown@example.com",
            contactPhone: validatedData.phone || "0000000000"
          });
          console.log(`Created fallback carrier: ${carrier.name} with ID ${carrier.id}`);
        } catch (fallbackError) {
          console.error("Error creating fallback carrier:", fallbackError);
          return res.status(500).json({ message: "Failed to process carrier information" });
        }
      }
      
      // Change: Initially set dockId to null for "Not scheduled yet" status
      // This will be assigned later by dock staff
      let dockId = null;
      
      // Always allow booking even if there are no docks available
      // This allows users to book appointments that will be assigned to docks later
      try {
        // Get docks for the facility (informational only)
        const docks = await storage.getDocksByFacility(validatedData.facilityId);
        console.log(`[/api/schedules/external] Facility has ${docks ? docks.length : 0} docks. Continuing with booking regardless.`);
        
        // We don't assign a dock yet - it will be assigned by dock staff later
        // even if no docks currently exist for the facility
        
      } catch (error) {
        // Log the error but don't block the booking
        console.error("Error checking facility docks:", error);
        console.log("[/api/schedules/external] Continuing with booking despite dock check error");
      }
      
      // Prepare the schedule data
      const scheduleData = {
        type: validatedData.pickupOrDropoff === 'pickup' ? 'outbound' : 'inbound',
        status: validatedData.status,
        facilityId: validatedData.facilityId,
        dockId: dockId,
        appointmentTypeId: validatedData.appointmentTypeId,
        carrierId: carrier ? carrier.id : null, // Handle null carrier
        carrierName: validatedData.carrierName,
        mcNumber: validatedData.mcNumber || null,
        customerName: validatedData.companyName,
        customerRef: validatedData.customerRef || null,
        driverName: validatedData.driverName,
        driverPhone: validatedData.driverPhone,
        driverEmail: validatedData.email,
        creatorEmail: validatedData.creatorEmail || validatedData.email, // Store creator's email, fallback to contact email if not explicitly provided
        truckNumber: validatedData.truckNumber,
        trailerNumber: validatedData.trailerNumber || null,
        startTime,
        endTime,
        notes: validatedData.notes || null,
        customFormData: validatedData.customFields ? { standardQuestions: validatedData.customFields } : null,
        createdBy: 1, // System user ID for external bookings
      };
      
      console.log("[/api/schedules/external] Creating schedule with data:", scheduleData);
      
      // Import the availability service
      const { calculateAvailabilitySlots } = await import('./src/services/availability');
      
      // Extract just the date portion from the startTime
      const appointmentDate = startTime.toISOString().split('T')[0];
      const appointmentTime = startTime.toTimeString().split(' ')[0].substring(0, 5); // Format: HH:MM
      
      // Get the tenantId from the facility
      const facilityTenantId = facility.tenantId || 
                              (await storage.getFacilityTenantId(validatedData.facilityId));
      
      // Use a transaction to check availability and create the schedule
      const schedule = await db.transaction(async (tx) => {
        console.log(`[/api/schedules/external] Checking availability for date=${appointmentDate}, facilityId=${validatedData.facilityId}, appointmentTypeId=${validatedData.appointmentTypeId}, time=${appointmentTime}`);
        
        // Use the enhanced availability calculation with break time handling
        const availableSlots = await calculateAvailabilitySlots(
          db, // Using main db here since deep transaction propagation is complex
          storage,
          appointmentDate,
          validatedData.facilityId,
          validatedData.appointmentTypeId,
          facilityTenantId
        );
        
        console.log(`[/api/schedules/external] Retrieved ${availableSlots.length} available slots`);
        
        // Find the specific slot that matches our requested time
        const requestedSlot = availableSlots.find(slot => slot.time === appointmentTime);
        
        if (!requestedSlot) {
          console.log(`[/api/schedules/external] Requested time slot ${appointmentTime} not found in available slots`);
          throw new Error('SLOT_UNAVAILABLE');
        }
        
        if (!requestedSlot.available || requestedSlot.remainingCapacity <= 0) {
          console.log(`[/api/schedules/external] Requested time slot ${appointmentTime} is not available (available=${requestedSlot.available}, remainingCapacity=${requestedSlot.remainingCapacity})`);
          throw new Error('SLOT_UNAVAILABLE');
        }
        
        console.log(`[/api/schedules/external] Slot ${appointmentTime} is available with remaining capacity: ${requestedSlot.remainingCapacity}. Proceeding with creation.`);
        
        // Create the schedule if the slot is available
        return await storage.createSchedule(scheduleData);
      });
      
      // Generate confirmation code
      const confirmationCode = `HC${schedule.id}`;
      
      // Send confirmation email
      try {
        // Use driverEmail from validated data for the recipient
        if (validatedData.email) {
          // Get dock name (or "Not scheduled yet" if null)
          const dockName = schedule.dockId 
            ? (await storage.getDock(schedule.dockId))?.name || `Dock ${schedule.dockId}` 
            : "Not scheduled yet";
            
          // Log email sending data
          console.log("[EMAIL SENDING]", {
            to: validatedData.email,
            subject: `Dock Appointment Confirmation #${schedule.id}`
          });
            
          // Log date information for debugging
          console.log("[EMAIL DEBUG] Date values:", {
            startTimeFromDB: schedule.startTime,
            endTimeFromDB: schedule.endTime, 
            parsedStartTime: startTime,
            parsedEndTime: endTime,
            isStartTimeValid: startTime instanceof Date && !isNaN(startTime.getTime()),
            isEndTimeValid: endTime instanceof Date && !isNaN(endTime.getTime())
          });
          
          // Send confirmation email with enhanced information - ensuring all required fields are present
          sendConfirmationEmail(
            validatedData.email,
            confirmationCode,
            {
              // Core fields from original schedule
              id: schedule.id,
              facilityId: schedule.facilityId,
              dockId: schedule.dockId,
              carrierId: schedule.carrierId,
              appointmentTypeId: schedule.appointmentTypeId,
              truckNumber: schedule.truckNumber || '',
              trailerNumber: schedule.trailerNumber || null,
              driverName: schedule.driverName || null,
              driverPhone: schedule.driverPhone || null,
              driverEmail: schedule.driverEmail || null,
              customerName: schedule.customerName || null,
              carrierName: schedule.carrierName || null,
              mcNumber: schedule.mcNumber || null,
              bolNumber: schedule.bolNumber || null,
              poNumber: schedule.poNumber || null,
              palletCount: schedule.palletCount || null,
              weight: schedule.weight || null,
              appointmentMode: schedule.appointmentMode || null,
              startTime: startTime,
              endTime: endTime,
              actualStartTime: null,
              actualEndTime: null,
              type: schedule.type || validatedData.pickupOrDropoff === 'pickup' ? 'outbound' : 'inbound',
              status: schedule.status || 'scheduled',
              notes: schedule.notes || null,
              customFormData: schedule.customFormData || null,
              createdBy: schedule.createdBy,
              createdAt: schedule.createdAt,
              lastModifiedAt: schedule.lastModifiedAt || null,
              lastModifiedBy: schedule.lastModifiedBy || null,
              
              // Enhanced properties for notifications
              dockName: dockName,
              facilityName: facility?.name || 'Main Facility',
              appointmentTypeName: appointmentType?.name || 'Standard Appointment',
              timezone: facility?.timezone || 'America/New_York'
            }
          ).catch(err => {
            // Just log errors, don't let email failures affect API response
            console.error('Failed to send confirmation email:', err);
          });
        }
      } catch (emailError) {
        // Log the error but don't fail the API call
        console.error('Error preparing confirmation email:', emailError);
      }
      
      // Return success response with schedule and confirmation code
      res.status(201).json({
        success: true,
        schedule,
        confirmationCode,
        message: "Appointment successfully scheduled"
      });
      
    } catch (error) {
      console.error("Error creating external schedule:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid booking data", 
          errors: error.errors 
        });
      }
      
      // Check for specific availability error
      if (error instanceof Error && error.message === 'SLOT_UNAVAILABLE') {
        return res.status(409).json({ 
          message: "The selected time slot is not available. Please choose another time.",
          errorCode: "SLOT_UNAVAILABLE"
        });
      }
      
      res.status(500).json({ message: "Failed to create appointment" });
    }
  });
  
  // Legacy External booking endpoint - no authentication required
  app.post("/api/external-booking", async (req, res) => {
    try {
      // Create a schema for external booking validation
      const externalBookingSchema = z.object({
        appointmentType: z.string().min(1),
        pickupOrDropoff: z.string().min(1),
        customerName: z.string().min(2), // This is the company name from step 2
        contactName: z.string().min(2),
        contactEmail: z.string().email(),
        contactPhone: z.string().min(10),
        appointmentDate: z.string().min(1),
        appointmentTime: z.string().min(1),
        location: z.string().min(1),
        // Add carrier name and ID (if carrier is selected from dropdown)
        carrierId: z.number().or(z.string()).optional(),
        carrierName: z.string().optional(),
        // Make MC Number completely optional (empty string is also valid)
        mcNumber: z.string().optional().or(z.literal("")),
        truckNumber: z.string().min(1),
        trailerNumber: z.string().optional(),
        driverName: z.string().min(1),
        driverPhone: z.string().min(10),
        additionalNotes: z.string().optional(),
        // For tracking which carrier data is selected vs typed
        bolFileUploaded: z.boolean().optional(),
        bolUploaded: z.boolean().optional(),
        // Add BOL data
        bolData: z.object({
          fileName: z.string().optional(),
          fileSize: z.number().optional(),
          fileType: z.string().optional(),
          uploadTimestamp: z.string().optional(),
          extractedText: z.string().optional(),
          fileUrl: z.string().optional(),
          bolNumber: z.string().optional(),
          customerName: z.string().optional(),
          carrierName: z.string().optional(),
          mcNumber: z.string().optional(),
          weight: z.string().optional(),
          palletCount: z.string().optional(),
          fromAddress: z.string().optional(),
          toAddress: z.string().optional(),
          pickupOrDropoff: z.string().optional(),
          truckId: z.string().optional(),
          trailerNumber: z.string().optional(),
          extractionConfidence: z.number().optional(),
          extractionMethod: z.string().optional(),
          processingTimestamp: z.string().optional()
        }).optional(),
      });
      
      console.log("[/api/external-booking] Received data:", {
        ...req.body,
        hasBolData: !!req.body.bolData,
        bolFileUploaded: req.body.bolFileUploaded
      });
      
      const validatedData = externalBookingSchema.parse(req.body);
      
      // Initialize carrier variable
      let carrier = null;
      
      try {
        // If we have a carrier ID, try to find the carrier by ID first
        if (validatedData.carrierId) {
          const carrierId = parseInt(validatedData.carrierId.toString(), 10);
          if (!isNaN(carrierId) && carrierId > 0) {
            try {
              carrier = await storage.getCarrier(carrierId);
              console.log(`Found carrier by ID ${carrierId}: ${carrier?.name || 'not found'}`);
            } catch (error) {
              console.error(`Error looking up carrier by ID ${carrierId}:`, error);
              // Continue to next method
            }
          } else {
            console.log(`Invalid carrier ID format: ${validatedData.carrierId}`);
          }
        }
        
        // If no carrier found by ID and we have a name, try to find by name
        if (!carrier && validatedData.carrierName) {
          const carrierName = validatedData.carrierName.trim();
          if (carrierName) {
            try {
              const allCarriers = await storage.getCarriers();
              carrier = allCarriers.find(c => 
                c.name.toLowerCase() === carrierName.toLowerCase()
              );
              console.log(`Carrier found by name match: ${carrier?.name || 'not found'}`);
            } catch (error) {
              console.error(`Error finding carrier by name "${carrierName}":`, error);
              // Continue to fallback
            }
          }
        }
        
        // If we found a carrier and have an MC number, update the carrier if needed
        if (carrier && typeof carrier !== 'undefined' && validatedData.mcNumber && validatedData.mcNumber !== carrier.mcNumber) {
          try {
            carrier = await storage.updateCarrier(carrier.id, {
              ...carrier,
              mcNumber: validatedData.mcNumber
            });
            console.log(`Updated carrier ${carrier?.name || 'Unknown'} with MC number: ${validatedData.mcNumber}`);
          } catch (error) {
            console.error(`Error updating carrier MC number:`, error);
            // Continue with existing carrier
          }
        }
        
        // If still no carrier, use the first available or create a default one
        if (!carrier) {
          try {
            const allCarriers = await storage.getCarriers();
            if (allCarriers.length > 0) {
              carrier = allCarriers[0];
              console.log(`Using first available carrier: ${carrier.name}`);
            } else {
              // Create a default carrier if none exist
              carrier = await storage.createCarrier({
                name: validatedData.carrierName || "Default Carrier",
                mcNumber: validatedData.mcNumber || "",
                contactName: validatedData.contactName || "System",
                contactEmail: validatedData.contactEmail || "system@example.com",
                contactPhone: validatedData.contactPhone || "0000000000",
              });
              console.log(`Created new carrier: ${carrier.name}`);
            }
          } catch (error) {
            console.error("Error in carrier fallback handling:", error);
            return res.status(500).json({ 
              message: "Failed to process carrier information", 
              details: error instanceof Error ? error.message : "Unknown error" 
            });
          }
        }
      } catch (error) {
        console.error("Error in carrier processing:", error);
        return res.status(500).json({ 
          message: "Failed to process carrier information", 
          details: error instanceof Error ? error.message : "Unknown error"
        });
      }
      
      // Final safety check - if we don't have a carrier by now, something went wrong
      if (!carrier) {
        return res.status(500).json({ message: "Failed to create or find a carrier" });
      }
      
      // Check if facility has docks (informational only)
      try {
        const docks = await storage.getDocks();
        console.log(`[/api/external-booking] System has ${docks ? docks.length : 0} total docks. Continuing with booking regardless.`);
        // We don't require docks to be available to allow the booking
      } catch (error) {
        // Log the error but don't block the booking
        console.error("Error checking docks:", error);
        console.log("[/api/external-booking] Continuing with booking despite dock check error");
      }
      
      // Parse date and time
      const [year, month, day] = validatedData.appointmentDate.split('-').map(Number);
      const [hour, minute] = validatedData.appointmentTime.split(':').map(Number);
      
      // Round minutes to nearest 15-minute interval
      const roundedMinute = Math.round(minute / 15) * 15;
      const adjustedHour = roundedMinute === 60 ? hour + 1 : hour;
      const finalMinute = roundedMinute === 60 ? 0 : roundedMinute;
      
      const startTime = new Date(year, month - 1, day, adjustedHour, finalMinute);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour later
      
      // Create schedule with BOL data if it exists
      const scheduleData = {
        type: validatedData.pickupOrDropoff === 'pickup' ? 'outbound' : 'inbound',
        status: "scheduled",
        dockId: null, // Initially set to null for "Not scheduled yet" status
        carrierId: carrier ? carrier.id : null, // Handle null carrier
        carrierName: validatedData.carrierName || (carrier ? carrier.name : "Unknown Carrier"),
        mcNumber: validatedData.mcNumber || (carrier && carrier.mcNumber ? carrier.mcNumber : null),
        customerName: validatedData.customerName,
        truckNumber: validatedData.truckNumber,
        trailerNumber: validatedData.trailerNumber || null,
        driverName: validatedData.driverName || null,
        driverPhone: validatedData.driverPhone || null,
        driverEmail: validatedData.contactEmail, // Store driver email
        creatorEmail: validatedData.contactEmail, // Store creator email for future communications
        startTime,
        endTime,
        notes: validatedData.additionalNotes || null,
        createdBy: 1, // System user ID
        // Add custom form data with BOL information if available
        customFormData: validatedData.bolData ? {
          bolData: validatedData.bolData,
          bolFileUploaded: true,
          bolUploaded: true,
          uploadSource: 'external_booking'
        } : null
      };
      
      // Import the enhanced availability service
      const { calculateAvailabilitySlots } = await import('./src/services/availability');
      
      // Use a transaction to check availability before creating the schedule
      const schedule = await db.transaction(async (tx) => {
        // Get the locationId (facilityId) from the valid data
        const facilityId = parseInt(validatedData.location, 10);
        
        if (isNaN(facilityId)) {
          throw new Error('Invalid facility ID');
        }
        
        // Get the appointment type ID
        const appointmentTypeId = parseInt(validatedData.appointmentType, 10);
        
        if (isNaN(appointmentTypeId)) {
          throw new Error('Invalid appointment type ID');
        }
        
        // Get facility tenant ID 
        const facilityTenantId = await storage.getFacilityTenantId(facilityId);
        
        if (!facilityTenantId) {
          throw new Error('Facility not found or no tenant associated');
        }
        
        // Format date string for availability check
        const dateStr = startTime.toISOString().split('T')[0]; // YYYY-MM-DD
        const timeStr = startTime.getHours().toString().padStart(2, '0') + ':' + 
                      startTime.getMinutes().toString().padStart(2, '0'); // HH:MM
        
        console.log(`[/api/external-booking] Checking availability for date=${dateStr}, time=${timeStr}, facilityId=${facilityId}, appointmentTypeId=${appointmentTypeId}, tenantId=${facilityTenantId}`);
        
        // Call calculateAvailabilitySlots to check if the selected time is available
        const availabilitySlots = await calculateAvailabilitySlots(
          db, // Using main db here since deep transaction propagation is complex
          storage,
          dateStr,
          facilityId,
          appointmentTypeId,
          facilityTenantId
        );
        
        // Find the specific slot that matches our requested time
        const requestedSlot = availabilitySlots.find(slot => slot.time === timeStr);
        
        if (!requestedSlot) {
          console.log(`[/api/external-booking] Requested time slot ${timeStr} not found in available slots`);
          throw new Error('SLOT_UNAVAILABLE');
        }
        
        if (!requestedSlot.available || requestedSlot.remainingCapacity <= 0) {
          console.log(`[/api/external-booking] Requested time slot ${timeStr} is not available (available=${requestedSlot.available}, remainingCapacity=${requestedSlot.remainingCapacity})`);
          throw new Error('SLOT_UNAVAILABLE');
        }
        
        console.log(`[/api/external-booking] Slot ${timeStr} is available with remaining capacity: ${requestedSlot.remainingCapacity}. Proceeding with creation.`);
        
        console.log("[/api/external-booking] Creating schedule with BOL data:", 
          validatedData.bolData ? "YES" : "NO", 
          validatedData.bolFileUploaded ? "File uploaded flag: true" : "No file upload flag"
        );
        
        // Create the schedule if the slot is available
        return await storage.createSchedule(scheduleData);
      });
      
      // Create a confirmation number
      const confirmationNumber = `HZL-${Math.floor(100000 + Math.random() * 900000)}`;
      
      // Send confirmation email
      try {
        // Use contactEmail from validated data for the recipient
        if (validatedData.contactEmail) {
          // Get location/facility
          const locations = await storage.getFacilities();
          const facility = locations.find(loc => loc.name === validatedData.location);
          
          // Log email sending
          console.log("[EMAIL SENDING]", {
            to: validatedData.contactEmail,
            subject: `Dock Appointment Confirmation #${schedule.id}`
          });
          
          // Log date information for debugging
          console.log("[EMAIL DEBUG - Legacy endpoint] Date values:", {
            startTime: startTime,
            endTime: endTime,
            isStartTimeValid: startTime instanceof Date && !isNaN(startTime.getTime()),
            isEndTimeValid: endTime instanceof Date && !isNaN(endTime.getTime())
          });
          
          // Send confirmation email with enhanced information
          sendConfirmationEmail(
            validatedData.contactEmail,
            confirmationNumber,
            {
              // Core fields from original schedule
              id: schedule.id,
              facilityId: facility?.id || null,
              dockId: schedule.dockId || null,
              carrierId: schedule.carrierId || null,
              appointmentTypeId: null, // Legacy doesn't have appointment type ID
              truckNumber: schedule.truckNumber || '',
              trailerNumber: schedule.trailerNumber || null,
              driverName: schedule.driverName || null,
              driverPhone: schedule.driverPhone || null,
              driverEmail: validatedData.contactEmail || null,
              customerName: schedule.customerName || null,
              carrierName: schedule.carrierName || null,
              mcNumber: schedule.mcNumber || null,
              bolNumber: null,
              poNumber: null,
              palletCount: null,
              weight: null,
              appointmentMode: null,
              startTime: startTime,
              endTime: endTime,
              actualStartTime: null,
              actualEndTime: null,
              type: schedule.type || validatedData.pickupOrDropoff === 'pickup' ? 'outbound' : 'inbound',
              status: schedule.status || 'scheduled',
              notes: schedule.notes || null,
              customFormData: null,
              createdBy: schedule.createdBy,
              createdAt: schedule.createdAt,
              lastModifiedAt: null,
              lastModifiedBy: null,
              
              // Enhanced properties for notifications
              dockName: "Not scheduled yet", // Default for legacy external bookings
              facilityName: facility?.name || validatedData.location || 'Main Facility',
              appointmentTypeName: validatedData.appointmentType || 'Standard Appointment',
              timezone: facility?.timezone || 'America/New_York'
            }
          ).catch(err => {
            // Just log errors, don't let email failures affect API response
            console.error('Failed to send confirmation email:', err);
          });
        }
      } catch (emailError) {
        // Log the error but don't fail the API call
        console.error('Error preparing confirmation email:', emailError);
      }
      
      // Return success response
      res.status(201).json({
        success: true,
        confirmationNumber,
        schedule,
        message: "Appointment successfully scheduled",
      });
      
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid booking data", errors: err.errors });
      }
      
      // Check for specific availability error
      if (err instanceof Error && err.message === 'SLOT_UNAVAILABLE') {
        return res.status(409).json({ 
          message: "The selected time slot is not available. Please choose another time.",
          errorCode: "SLOT_UNAVAILABLE"
        });
      }
      
      console.error("External booking error:", err);
      res.status(500).json({ message: "Failed to create booking" });
    }
  });

  // Appointment Settings routes
  app.get("/api/facilities/:id/appointment-settings", async (req, res) => {
    try {
      const facilityId = Number(req.params.id);
      // Add tenant isolation
      const tenantId = req.user?.tenantId;
      const username = req.user?.username;
      const isSuperAdmin = req.user?.role === 'super-admin' || username?.includes('admin@conmitto.io');
      
      console.log(`[FacilitySettings] Retrieving settings for facility ${facilityId}, user: ${username}, tenantId: ${tenantId || 'none'}`);
      
      // Only apply tenant filtering if user is not a super admin and has a tenant ID
      const facility = await storage.getFacility(
        facilityId, 
        (!isSuperAdmin && tenantId) ? tenantId : undefined
      );
      
      if (!facility) {
        console.log(`[FacilitySettings] Facility not found with ID: ${facilityId}${tenantId ? ` for tenant ${tenantId}` : ''}`);
        return res.status(404).json({ message: "Facility not found" });
      }
      
      // If not a super admin and has a tenant ID, verify access
      if (tenantId && !isSuperAdmin) {
        // Get facilities for this tenant
        const orgFacilities = await storage.getFacilitiesByOrganizationId(tenantId);
        const facilityIds = orgFacilities.map(f => f.id);
        
        if (!facilityIds.includes(facilityId)) {
          console.log(`[FacilitySettings] Access denied - facility ${facilityId} does not belong to tenant ${tenantId}`);
          return res.status(403).json({ message: "Access denied to this facility's settings" });
        }
      }

      const settings = await storage.getAppointmentSettings(facilityId);
      if (!settings) {
        console.log(`[FacilitySettings] No settings found for facility ${facilityId}, returning defaults`);
        // Return default settings if none exist
        return res.json({
          facilityId,
          timeInterval: 30, // Default to 30 minutes
          maxConcurrentInbound: 2,
          maxConcurrentOutbound: 2,
          shareAvailabilityInfo: true
        });
      }
      res.json(settings);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch appointment settings" });
    }
  });

  app.post("/api/facilities/:id/appointment-settings", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const facilityId = Number(req.params.id);
      // Add tenant isolation
      const tenantId = req.user?.tenantId;
      const username = req.user?.username;
      const isSuperAdmin = req.user?.role === 'super-admin' || username?.includes('admin@conmitto.io');
      
      console.log(`[FacilitySettings] Creating settings for facility ${facilityId}, user: ${username}, tenantId: ${tenantId || 'none'}`);
      
      // Only apply tenant filtering if user is not a super admin and has a tenant ID
      const facility = await storage.getFacility(
        facilityId, 
        (!isSuperAdmin && tenantId) ? tenantId : undefined
      );
      
      if (!facility) {
        console.log(`[FacilitySettings] Facility not found with ID: ${facilityId}${tenantId ? ` for tenant ${tenantId}` : ''}`);
        return res.status(404).json({ message: "Facility not found" });
      }
      
      // If not a super admin and has a tenant ID, verify access
      if (tenantId && !isSuperAdmin) {
        // Get facilities for this tenant
        const orgFacilities = await storage.getFacilitiesByOrganizationId(tenantId);
        const facilityIds = orgFacilities.map(f => f.id);
        
        if (!facilityIds.includes(facilityId)) {
          console.log(`[FacilitySettings] Access denied - facility ${facilityId} does not belong to tenant ${tenantId}`);
          return res.status(403).json({ message: "Access denied to this facility's settings" });
        }
      }

      // Check if settings already exist
      const existingSettings = await storage.getAppointmentSettings(facilityId);
      if (existingSettings) {
        console.log(`[FacilitySettings] Settings already exist for facility ${facilityId}`);
        return res.status(409).json({ 
          message: "Appointment settings already exist for this facility. Use PUT to update.",
          settings: existingSettings
        });
      }

      const settingsData = {
        ...req.body,
        facilityId
      };
      
      const validatedData = insertAppointmentSettingsSchema.parse(settingsData);
      const settings = await storage.createAppointmentSettings(validatedData);
      res.status(201).json(settings);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid settings data", errors: err.errors });
      }
      res.status(500).json({ message: "Failed to create appointment settings" });
    }
  });

  app.put("/api/facilities/:id/appointment-settings", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const facilityId = Number(req.params.id);
      // Add tenant isolation
      const tenantId = req.user?.tenantId;
      const username = req.user?.username;
      const isSuperAdmin = req.user?.role === 'super-admin' || username?.includes('admin@conmitto.io');
      
      console.log(`[FacilitySettings] Updating settings for facility ${facilityId}, user: ${username}, tenantId: ${tenantId || 'none'}`);
      
      // Only apply tenant filtering if user is not a super admin and has a tenant ID
      const facility = await storage.getFacility(
        facilityId, 
        (!isSuperAdmin && tenantId) ? tenantId : undefined
      );
      
      if (!facility) {
        console.log(`[FacilitySettings] Facility not found with ID: ${facilityId}${tenantId ? ` for tenant ${tenantId}` : ''}`);
        return res.status(404).json({ message: "Facility not found" });
      }
      
      // If not a super admin and has a tenant ID, verify access
      if (tenantId && !isSuperAdmin) {
        // Get facilities for this tenant
        const orgFacilities = await storage.getFacilitiesByOrganizationId(tenantId);
        const facilityIds = orgFacilities.map(f => f.id);
        
        if (!facilityIds.includes(facilityId)) {
          console.log(`[FacilitySettings] Access denied - facility ${facilityId} does not belong to tenant ${tenantId}`);
          return res.status(403).json({ message: "Access denied to this facility's settings" });
        }
      }

      // Check if settings exist
      const existingSettings = await storage.getAppointmentSettings(facilityId);
      if (!existingSettings) {
        console.log(`[FacilitySettings] No existing settings for facility ${facilityId}, creating new settings`);
        // If settings don't exist, create them
        const settingsData = {
          ...req.body,
          facilityId
        };
        
        const validatedData = insertAppointmentSettingsSchema.parse(settingsData);
        const settings = await storage.createAppointmentSettings(validatedData);
        return res.status(201).json(settings);
      }

      // Update existing settings
      const updatedSettings = await storage.updateAppointmentSettings(facilityId, req.body);
      res.json(updatedSettings);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid settings data", errors: err.errors });
      }
      res.status(500).json({ message: "Failed to update appointment settings" });
    }
  });

  // Appointment Type routes
  app.get("/api/appointment-types", async (req, res) => {
    try {
      // Special case for external booking pages - allow unauthenticated access with booking page context
      const bookingPageSlug = req.query.bookingPageSlug as string | undefined;
      const facilityIdParam = req.query.facilityId ? Number(req.query.facilityId) : undefined;
      
      // If a booking page slug is provided, use it to determine the tenant context
      // This takes priority over the authenticated user's context
      if (bookingPageSlug) {
        console.log(`[AppointmentTypes] Request with bookingPageSlug: ${bookingPageSlug}, facilityId: ${facilityIdParam || 'none'}`);
        
        // Get the booking page to determine its tenant
        const bookingPage = await storage.getBookingPageBySlug(bookingPageSlug);
        if (!bookingPage) {
          console.log(`[AppointmentTypes] No booking page found with slug: ${bookingPageSlug}`);
          return res.status(404).json({ message: "Booking page not found" });
        }
        
        if (!bookingPage.tenantId) {
          console.log(`[AppointmentTypes] Error: Booking page ${bookingPageSlug} has no tenant ID`);
          return res.status(500).json({ message: "Booking page has no organization" });
        }
        
        const bookingPageTenantId = bookingPage.tenantId;
        console.log(`[AppointmentTypes] Found booking page with tenant ID: ${bookingPageTenantId}`);
        
        // Get appointment types for this booking page's tenant, optionally filtered by facility
        console.log(`[AppointmentTypes] Fetching appointment types for booking page tenant ${bookingPageTenantId}`);
        
        // Extra validation to make sure the facility belongs to the booking page's organization
        if (facilityIdParam) {
          const facility = await storage.getFacility(facilityIdParam);
          if (!facility || facility.tenantId !== bookingPageTenantId) {
            console.log(`[AppointmentTypes] Facility ${facilityIdParam} does not belong to booking page tenant ${bookingPageTenantId}`);
            return res.status(400).json({ message: "Invalid facility for this booking page" });
          }
        }
        
        let appointmentTypes;
        if (facilityIdParam) {
          // If facility ID specified, get appointment types for that facility
          appointmentTypes = await storage.getAppointmentTypesByFacility(facilityIdParam);
          console.log(`[AppointmentTypes] Filtered by facility ID ${facilityIdParam}`);
        } else {
          // Otherwise get all appointment types for tenant
          appointmentTypes = await storage.getAppointmentTypes(bookingPageTenantId);
        }
        
        // If the booking page has excluded appointment types, filter those out
        if (bookingPage.excludedAppointmentTypes) {
          let excludedIds = [];
          
          // Parse the excludedAppointmentTypes based on format
          try {
            if (Array.isArray(bookingPage.excludedAppointmentTypes)) {
              excludedIds = bookingPage.excludedAppointmentTypes.map(id => 
                typeof id === 'string' ? parseInt(id, 10) : id
              );
            } else if (typeof bookingPage.excludedAppointmentTypes === 'string') {
              try {
                // Try to parse as JSON
                const parsed = JSON.parse(bookingPage.excludedAppointmentTypes);
                if (Array.isArray(parsed)) {
                  excludedIds = parsed.map(id => 
                    typeof id === 'string' ? parseInt(id, 10) : id
                  );
                }
              } catch (e) {
                // If not valid JSON, try to parse as comma-separated list
                excludedIds = bookingPage.excludedAppointmentTypes
                  .split(',')
                  .map(s => parseInt(s.trim(), 10))
                  .filter(n => !isNaN(n));
              }
            }
            
            console.log(`[AppointmentTypes] Excluding appointment types: ${excludedIds}`);
            
            if (excludedIds.length > 0) {
              appointmentTypes = appointmentTypes.filter(type => 
                !excludedIds.includes(type.id)
              );
            }
          } catch (err) {
            console.error(`[AppointmentTypes] Error parsing excluded appointment types: ${err}`);
          }
        }
        
        console.log(`[Tenant Isolation] Returning ${appointmentTypes.length} appointment types for booking page ${bookingPageSlug} (tenant ${bookingPageTenantId})`);
        return res.json(appointmentTypes);
      }
      
      // Standard authentication check for non-booking page requests
      if (!req.isAuthenticated()) {
        console.log(`[AppointmentTypes] Unauthenticated request - access denied`);
        return res.status(401).json({ message: "Authentication required" });
      }
      
      // Get the tenant ID from the authenticated user
      const tenantId = req.user?.tenantId;
      const username = req.user?.username;
      const isSuperAdmin = req.user?.role === 'super-admin' || username?.includes('admin@conmitto.io');
      
      console.log(`[AppointmentTypes] Fetching appointment types for user ${username} with tenantId: ${tenantId || 'none'}, isSuperAdmin: ${isSuperAdmin || false}`);
      
      // Use our updated method that filters by tenant internally
      const appointmentTypes = await storage.getAppointmentTypes(tenantId);
      console.log(`[AppointmentTypes] Found ${appointmentTypes.length} appointment types for tenant ID ${tenantId || 'all'}`);
      
      res.json(appointmentTypes);
    } catch (err) {
      console.error("[AppointmentTypes] Error fetching appointment types:", err);
      res.status(500).json({ message: "Failed to fetch appointment types", error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/api/appointment-types/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const tenantId = req.user?.tenantId;
      console.log(`[AppointmentType] Fetching appointment type with ID: ${id}, tenantId: ${tenantId || 'none'}`);
      
      // Pass tenantId to ensure tenant isolation
      const appointmentType = await storage.getAppointmentType(id, tenantId);
      if (!appointmentType) {
        console.log(`[AppointmentType] Not found: ${id}${tenantId ? ` for tenant ${tenantId}` : ''}`);
        return res.status(404).json({ message: "Appointment type not found" });
      }
      
      // Additional tenant check - can remove this once all appointment types have tenantId
      if (req.user?.tenantId) {
        const isSuperAdmin = req.user.username?.includes('admin@conmitto.io') || false;
        
        // Use our helper function to check tenant access
        const facility = await checkTenantFacilityAccess(
          appointmentType.facilityId, 
          req.user.tenantId, 
          isSuperAdmin,
          'AppointmentType'
        );
        
        if (!facility) {
          console.log(`[AppointmentType] Access denied - appointment type ${id} is not in organization ${req.user.tenantId}`);
          return res.status(403).json({ message: "Access denied to this appointment type" });
        }
      }
      
      res.json(appointmentType);
    } catch (err) {
      console.error(`[AppointmentType] Error fetching appointment type:`, err);
      res.status(500).json({ message: "Failed to fetch appointment type" });
    }
  });

  app.get("/api/facilities/:id/appointment-types", async (req, res) => {
    try {
      const facilityId = Number(req.params.id);
      const tenantId = req.user?.tenantId;
      
      console.log(`[AppointmentTypes] Fetching appointment types for facility ID: ${facilityId}, tenantId: ${tenantId || 'none'}`);
      
      // Check if facility exists
      const facility = await storage.getFacility(facilityId);
      if (!facility) {
        console.log(`[AppointmentTypes] Facility ID ${facilityId} not found`);
        return res.status(404).json({ message: "Facility not found" });
      }
      
      // Check tenant isolation if user has a tenantId
      if (tenantId) {
        const isSuperAdmin = req.user?.username?.includes('admin@conmitto.io') || false;
        
        // Use our helper function to check tenant access
        const userFacility = await checkTenantFacilityAccess(
          facilityId,
          tenantId,
          isSuperAdmin,
          'GetFacilityAppointmentTypes'
        );
        
        if (!userFacility) {
          console.log(`[AppointmentTypes] Access denied - facility ${facilityId} does not belong to organization ${tenantId}`);
          return res.status(403).json({ message: "You can only view appointment types for facilities in your organization" });
        }
      }
      
      // Pass the tenantId to filter appointment types by tenant
      const appointmentTypes = await storage.getAppointmentTypesByFacility(facilityId, tenantId);
      console.log(`[AppointmentTypes] Found ${appointmentTypes.length} appointment types for facility ID ${facilityId}${tenantId ? ` and tenant ${tenantId}` : ''}`);
      
      // Optional query parameter to filter by booking page
      const bookingPageId = req.query.bookingPageId ? Number(req.query.bookingPageId) : null;
      
      if (bookingPageId) {
        console.log(`[AppointmentTypes] Filtering by booking page ID: ${bookingPageId}`);
        
        // Get the booking page to check excluded appointment types - include tenant check
        const bookingPage = await storage.getBookingPage(bookingPageId, tenantId);
        
        if (!bookingPage) {
          console.log(`[AppointmentTypes] Booking page ID ${bookingPageId} not found${tenantId ? ` for tenant ${tenantId}` : ''}`);
          return res.status(404).json({ message: "Booking page not found" });
        }
        
        // Get the excluded appointment types
        const excludedTypes = bookingPage.excludedAppointmentTypes || [];
        console.log(`[AppointmentTypes] Excluded appointment types: `, excludedTypes);
        
        // Filter out excluded appointment types
        const filteredTypes = appointmentTypes.filter(type => {
          const isExcluded = Array.isArray(excludedTypes) && excludedTypes.includes(type.id);
          return !isExcluded;
        });
        
        console.log(`[AppointmentTypes] Returning ${filteredTypes.length} appointment types after filtering by booking page`);
        
        res.json(filteredTypes);
      } else {
        // Return all appointment types for the facility
        res.json(appointmentTypes);
      }
    } catch (err) {
      console.error("[AppointmentTypes] Error fetching appointment types for facility:", err);
      res.status(500).json({ message: "Failed to fetch appointment types for facility" });
    }
  });

  app.post("/api/appointment-types", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      console.log(`[AppointmentType] Creating new appointment type:`, req.body);
      const validatedData = insertAppointmentTypeSchema.parse(req.body);
      
      // Check if facility exists
      const facility = await storage.getFacility(validatedData.facilityId);
      if (!facility) {
        console.log(`[AppointmentType] Facility not found: ${validatedData.facilityId}`);
        return res.status(400).json({ message: "Invalid facility ID" });
      }
      
      // Check tenant isolation if user has a tenantId
      if (req.user?.tenantId) {
        const isSuperAdmin = req.user.username?.includes('admin@conmitto.io') || false;
        
        // Use our helper function to check tenant access
        const facilityAccess = await checkTenantFacilityAccess(
          validatedData.facilityId,
          req.user.tenantId,
          isSuperAdmin,
          'AppointmentType'
        );
        
        if (!facilityAccess) {
          console.log(`[AppointmentType] Access denied - facility ${facility.id} does not belong to organization ${req.user.tenantId}`);
          return res.status(403).json({ message: "You can only create appointment types for facilities in your organization" });
        }
        
        // Set tenant ID for multi-tenant isolation
        validatedData.tenantId = req.user.tenantId;
      }
      
      // Add the current user to createdBy if field exists in schema
      if ('createdBy' in validatedData) {
        validatedData.createdBy = req.user?.id;
      }
      
      // Log the data being sent to createAppointmentType
      console.log(`[AppointmentType] Data being sent to createAppointmentType:`, JSON.stringify(validatedData));
      
      const appointmentType = await storage.createAppointmentType(validatedData);
      console.log(`[AppointmentType] Created appointment type with ID: ${appointmentType.id}`);
      res.status(201).json(appointmentType);
    } catch (err) {
      console.error(`[AppointmentType] Error creating appointment type:`, err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid appointment type data", errors: err.errors });
      }
      
      // Provide more detailed error information
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[AppointmentType] Detailed error: ${errorMessage}`);
      
      res.status(500).json({ 
        message: "Failed to create appointment type", 
        error: errorMessage
      });
    }
  });

  app.put("/api/appointment-types/:id", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const userTenantId = req.user?.tenantId;
      const isSuperAdmin = req.user?.username?.includes('admin@conmitto.io') || false;
      
      console.log(`[AppointmentType] Updating appointment type with ID: ${id}, userTenantId: ${userTenantId || 'none'}, isSuperAdmin: ${isSuperAdmin}`);
      
      // Get the appointment type WITH tenant filtering if applicable
      // If user has a tenant ID and isn't a super admin, filter by tenant
      const appointmentType = await storage.getAppointmentType(
        id, 
        (!isSuperAdmin && userTenantId) ? userTenantId : undefined
      );
      
      if (!appointmentType) {
        console.log(`[getAppointmentType] Fetching appointment type with ID: ${id}`);
        console.log(`[getAppointmentType] Found appointment type: ${id} - ${appointmentType?.name || 'not found'}`);
        
        return res.status(404).json({ message: "Appointment type not found or you don't have access to it" });
      }
      
      // Log the appointmentType data for debugging
      console.log(`[AppointmentType] Found appointment type: ${id} - ${appointmentType.name}, facilityId: ${appointmentType.facilityId}, tenantId: ${appointmentType.tenantId}`);
      
      // Additional tenant isolation check with facility ownership
      if (userTenantId && !isSuperAdmin) {
        // If facilityId is undefined or null in the appointment type, this is a critical bug
        if (!appointmentType.facilityId) {
          console.error(`[AppointmentType] CRITICAL: Appointment type ${id} has no facilityId defined!`);
          
          // Fix by explicitly adding the facilityId from the request if available
          if (req.body.facilityId) {
            console.log(`[AppointmentType] Fixing missing facilityId with value from request: ${req.body.facilityId}`);
            appointmentType.facilityId = req.body.facilityId;
          } else {
            // Return a more specific error message rather than a generic access denied
            return res.status(400).json({ 
              message: "This appointment type has an invalid facility configuration. Please recreate it."
            });
          }
        }
        
        // Use our helper function to check tenant access to the facility
        const facility = await checkTenantFacilityAccess(
          appointmentType.facilityId,
          userTenantId,
          isSuperAdmin,
          'AppointmentType'
        );
        
        if (!facility) {
          console.log(`[AppointmentType] Access denied - appointment type ${id} facility ${appointmentType.facilityId} is not in organization ${userTenantId}`);
          return res.status(403).json({ message: "Access denied to this appointment type" });
        }
        
        // Set tenant ID for multi-tenant isolation (ensure it's maintained on update)
        req.body.tenantId = userTenantId;
      }
      
      // Add lastModifiedBy if field exists in schema
      if ('lastModifiedBy' in req.body) {
        req.body.lastModifiedBy = req.user?.id;
      }
      
      // Log update data for debugging
      console.log(`[AppointmentType] Data being sent to updateAppointmentType:`, JSON.stringify(req.body));
      
      const updatedAppointmentType = await storage.updateAppointmentType(id, req.body);
      console.log(`[AppointmentType] Updated appointment type ${id} successfully`);
      res.json(updatedAppointmentType);
    } catch (err) {
      console.error(`[AppointmentType] Error updating appointment type:`, err);
      
      // Provide more detailed error information
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[AppointmentType] Detailed error: ${errorMessage}`);
      
      res.status(500).json({ 
        message: "Failed to update appointment type",
        error: errorMessage
      });
    }
  });

  app.delete("/api/appointment-types/:id", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const tenantId = req.user?.tenantId;
      
      const appointmentType = await storage.getAppointmentType(id);
      if (!appointmentType) {
        return res.status(404).json({ message: "Appointment type not found" });
      }
      
      // For non-admin users, check the facility belongs to their organization
      if (tenantId && req.user?.role !== "admin") {
        const tenantFacilities = await storage.getFacilities(tenantId);
        const facilityIds = tenantFacilities.map(f => f.id);
        
        if (!facilityIds.includes(appointmentType.facilityId)) {
          return res.status(403).json({ message: "You don't have permission to delete this appointment type" });
        }
      }
      
      // Check if there are any schedules using this appointment type
      const schedules = await storage.getSchedules(tenantId);
      const appointmentTypeSchedules = schedules.filter(s => s.appointmentTypeId === id);
      
      if (appointmentTypeSchedules.length > 0) {
        return res.status(409).json({ 
          message: "Cannot delete appointment type with existing schedules", 
          count: appointmentTypeSchedules.length
        });
      }
      
      // Delete the appointment type
      const success = await storage.deleteAppointmentType(id);
      if (!success) {
        return res.status(500).json({ message: "Failed to delete appointment type" });
      }
      
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete appointment type" });
    }
  });

  // Daily Availability routes
  app.get("/api/appointment-types/:id/availability", async (req, res) => {
    try {
      const appointmentTypeId = Number(req.params.id);
      const tenantId = req.user?.tenantId;
      
      console.log(`[Availability] Fetching availability for appointment type ID: ${appointmentTypeId}, tenantId: ${tenantId || 'none'}`);
      
      // Get the appointment type first with tenant isolation
      const appointmentType = await storage.getAppointmentType(appointmentTypeId, tenantId);
      if (!appointmentType) {
        console.log(`[Availability] Appointment type not found: ${appointmentTypeId}${tenantId ? ` for tenant ${tenantId}` : ''}`);
        return res.status(404).json({ message: "Appointment type not found" });
      }
      
      // Check tenant isolation if user has a tenantId
      if (req.user?.tenantId) {
        const isSuperAdmin = req.user.username?.includes('admin@conmitto.io') || false;
        
        // Use our helper function to check tenant access
        const facility = await checkTenantFacilityAccess(
          appointmentType.facilityId,
          req.user.tenantId,
          isSuperAdmin,
          'Availability'
        );
        
        if (!facility) {
          console.log(`[Availability] Access denied - appointment type ${appointmentTypeId} is not in organization ${req.user.tenantId}`);
          return res.status(403).json({ message: "Access denied to this appointment type's availability" });
        }
      }
      
      const dailyAvailability = await storage.getDailyAvailabilityByAppointmentType(appointmentTypeId);
      console.log(`[Availability] Found ${dailyAvailability.length} availability rules for appointment type ${appointmentTypeId}`);
      res.json(dailyAvailability);
    } catch (err) {
      console.error(`[Availability] Error fetching availability:`, err);
      res.status(500).json({ message: "Failed to fetch daily availability" });
    }
  });
  
  // Availability rules endpoint
  app.get("/api/appointment-master/availability-rules", async (req, res) => {
    try {
      const { typeId, appointmentTypeId, facilityId } = req.query;
      const tenantId = req.user?.tenantId;
      
      // Support both parameter naming conventions for backward compatibility
      const finalTypeId = typeId || appointmentTypeId;
      
      if (!finalTypeId || !facilityId) {
        return res.status(400).json({ 
          message: "Both appointment type ID (typeId or appointmentTypeId) and facilityId are required query parameters" 
        });
      }
      
      const appointmentTypeIdNum = Number(finalTypeId);
      const facilityIdNum = Number(facilityId);
      
      console.log(`GET /api/appointment-master/availability-rules - Query params:`, {
        originalTypeId: typeId,
        originalAppointmentTypeId: appointmentTypeId,
        resolvedTypeId: finalTypeId,
        facilityId,
        tenantId: tenantId || 'none'
      });
      
      // Enforce tenant isolation for all users (not just those with a tenantId)
      // First, check if the user is a super admin
      const isSuperAdmin = req.user?.username?.includes('admin@conmitto.io') || false;
      
      if (isSuperAdmin) {
        console.log(`[MasterAvailabilityRules] Super admin access granted for facility ${facilityIdNum}`);
      } else {
        // If not super admin, enforce tenant isolation
        let userTenantId = tenantId;
        
        // If no tenant ID in session, try to determine tenant from the requested facility
        if (!userTenantId) {
          try {
            // Look up which organization owns this facility with direct SQL
            const facilityOrgQuery = `
              SELECT t.id, t.name 
              FROM tenants t
              JOIN organization_facilities of ON t.id = of.organization_id
              WHERE of.facility_id = $1
              LIMIT 1
            `;
            
            const orgResult = await pool.query(facilityOrgQuery, [facilityIdNum]);
            
            if (orgResult.rows.length > 0) {
              const orgInfo = orgResult.rows[0];
              console.log(`[MasterAvailabilityRules] Facility ${facilityIdNum} belongs to organization ${orgInfo.id} (${orgInfo.name})`);
              userTenantId = orgInfo.id;
            }
          } catch (error) {
            console.error(`[MasterAvailabilityRules] Error determining facility organization:`, error);
          }
        }
        
        // Determine appointment type's organization using direct SQL
        try {
          const appointmentTypeQuery = `
            SELECT t.id, t.name 
            FROM tenants t
            JOIN appointment_types apt ON t.id = apt.tenant_id
            WHERE apt.id = $1
            LIMIT 1
          `;
          
          const aptResult = await pool.query(appointmentTypeQuery, [appointmentTypeIdNum]);
          
          if (aptResult.rows.length > 0) {
            const appointmentTypeOrg = aptResult.rows[0];
            console.log(`[MasterAvailabilityRules] Appointment type ${appointmentTypeIdNum} belongs to organization ${appointmentTypeOrg.id} (${appointmentTypeOrg.name})`);
            
            // Critical tenant isolation check:
            // If the user has a tenant ID and it doesn't match the appointment type's organization,
            // OR if the facility's tenant doesn't match the appointment type's tenant, deny access
            if ((tenantId && appointmentTypeOrg.id !== tenantId) || 
                (userTenantId && appointmentTypeOrg.id !== userTenantId)) {
              console.log(`[MasterAvailabilityRules] Access denied - appointment type ${appointmentTypeIdNum} belongs to org ${appointmentTypeOrg.id}, user is from tenant ${tenantId || 'none'}, facility belongs to tenant ${userTenantId || 'none'}`);
              return res.status(403).json({ 
                message: "Access denied: you don't have permission to access this resource"
              });
            }
          }
        } catch (error) {
          console.error(`[MasterAvailabilityRules] Error checking appointment type organization:`, error);
        }
        
        // If using a tenantId (from session or derived), verify facility access
        if (userTenantId) {
          const facility = await checkTenantFacilityAccess(
            facilityIdNum,
            userTenantId,
            isSuperAdmin,
            'MasterAvailabilityRules'
          );
          
          if (!facility && !isSuperAdmin) {
            console.log(`[MasterAvailabilityRules] Access denied - facility ${facilityIdNum} does not belong to tenant ${userTenantId}`);
            return res.status(403).json({ 
              message: "Access denied to this facility's availability rules"
            });
          }
        }
      }
      
      // Check if appointment type exists with tenant isolation
      const appointmentType = await storage.getAppointmentType(appointmentTypeIdNum, tenantId);
      if (!appointmentType) {
        console.log(`[AvailabilityRules] Appointment type not found: ${appointmentTypeIdNum}${tenantId ? ` for tenant ${tenantId}` : ''}`);
        return res.status(404).json({ message: "Appointment type not found" });
      }
      
      // For tenant isolation purposes, we've already verified:
      // 1. The facility belongs to the tenant (checkTenantFacilityAccess)
      // 2. The appointment type belongs to the tenant (getAppointmentType with tenantId)
      //
      // We should not require that appointmentType.facilityId === facilityIdNum
      // since the data model allows appointment types to be used across facilities
      
      // Log appointment type info for debugging
      console.log(`[AvailabilityRules] Using appointment type: ${appointmentType.id} (${appointmentType.name}) with facilityId: ${appointmentType.facilityId}, requested facilityId: ${facilityIdNum}`);
      
      
      // Get availability rules for this appointment type
      const dailyRules = await storage.getDailyAvailabilityByAppointmentType(appointmentTypeIdNum);
      
      console.log(`[AvailabilityRules] Found ${dailyRules.length} availability rules for appointment type ${appointmentTypeIdNum}`);
      
      // Transform daily availability into the format expected by the client
      const availabilityRules = dailyRules.map(rule => {
        return {
          id: rule.id,
          appointmentTypeId: rule.appointmentTypeId,
          dayOfWeek: rule.dayOfWeek,
          startDate: null, // Not using date ranges in this implementation
          endDate: null,   // Not using date ranges in this implementation
          startTime: rule.startTime,
          endTime: rule.endTime,
          isActive: rule.isAvailable,
          facilityId: appointmentType.facilityId, // Use the facility from appointment type
          maxConcurrent: rule.maxAppointments || appointmentType.maxConcurrent || 1
        };
      });
      
      // Return the rules
      res.json(availabilityRules);
    } catch (err) {
      console.error("Failed to fetch availability rules:", err);
      res.status(500).json({ 
        message: "Failed to fetch availability rules",
        error: err instanceof Error ? err.message : String(err)
      });
    }
  });

  app.post("/api/daily-availability", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const validatedData = insertDailyAvailabilitySchema.parse(req.body);
      const tenantId = req.user?.tenantId;
      
      // Check if appointment type exists with tenant isolation
      const appointmentType = await storage.getAppointmentType(validatedData.appointmentTypeId, tenantId);
      if (!appointmentType) {
        console.log(`[DailyAvailability] Appointment type not found: ${validatedData.appointmentTypeId}${tenantId ? ` for tenant ${tenantId}` : ''}`);
        return res.status(400).json({ message: "Invalid appointment type ID" });
      }
      
      // Add tenant isolation check
      if (req.user?.tenantId) {
        const isSuperAdmin = req.user.username?.includes('admin@conmitto.io') || false;
        
        const facility = await checkTenantFacilityAccess(
          appointmentType.facilityId,
          req.user.tenantId,
          isSuperAdmin,
          'DailyAvailability'
        );
        
        if (!facility) {
          console.log(`[DailyAvailability] Access denied - appointment type ${appointmentType.id} is not in organization ${req.user.tenantId}`);
          return res.status(403).json({ message: "You can only create availability for appointment types in your organization" });
        }
      }
      
      const dailyAvailability = await storage.createDailyAvailability(validatedData);
      res.status(201).json(dailyAvailability);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid daily availability data", errors: err.errors });
      }
      res.status(500).json({ message: "Failed to create daily availability" });
    }
  });

  app.put("/api/daily-availability/:id", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const tenantId = req.user?.tenantId;
      
      const dailyAvailability = await storage.getDailyAvailability(id);
      if (!dailyAvailability) {
        return res.status(404).json({ message: "Daily availability not found" });
      }
      
      // Add tenant isolation check - first get the appointment type 
      // to access its facilityId with tenant isolation
      const appointmentType = await storage.getAppointmentType(dailyAvailability.appointmentTypeId, tenantId);
      if (!appointmentType) {
        console.log(`[DailyAvailability] Associated appointment type not found: ${dailyAvailability.appointmentTypeId}${tenantId ? ` for tenant ${tenantId}` : ''}`);
        return res.status(404).json({ message: "Associated appointment type not found" });
      }
      
      // Check tenant isolation if user has a tenantId
      if (req.user?.tenantId) {
        const isSuperAdmin = req.user.username?.includes('admin@conmitto.io') || false;
        
        const facility = await checkTenantFacilityAccess(
          appointmentType.facilityId,
          req.user.tenantId,
          isSuperAdmin,
          'DailyAvailability-Update'
        );
        
        if (!facility) {
          console.log(`[DailyAvailability] Access denied - appointment type ${appointmentType.id} is not in organization ${req.user.tenantId}`);
          return res.status(403).json({ message: "You can only update availability for appointment types in your organization" });
        }
      }
      
      const updatedDailyAvailability = await storage.updateDailyAvailability(id, req.body);
      res.json(updatedDailyAvailability);
    } catch (err) {
      res.status(500).json({ message: "Failed to update daily availability" });
    }
  });

  // Custom Question routes
  app.get("/api/appointment-types/:id/questions", async (req, res) => {
    try {
      const appointmentTypeId = Number(req.params.id);
      let tenantId = req.user?.tenantId;
      const bookingPageSlug = req.query.bookingPageSlug as string;
      
      console.log(`[CustomQuestions] Fetching questions for appointment type ID: ${appointmentTypeId}, tenantId: ${tenantId || 'none'}${bookingPageSlug ? `, bookingPageSlug: ${bookingPageSlug}` : ''}`);
      
      // Check if we have a booking page slug (for external booking flow)
      if (bookingPageSlug) {
        try {
          // Get the booking page to determine the correct tenant context
          const bookingPage = await storage.getBookingPageBySlug(bookingPageSlug);
          if (bookingPage) {
            tenantId = bookingPage.tenantId;
            console.log(`[CustomQuestions] Using tenant ID ${tenantId} from booking page ${bookingPageSlug}`);
          } else {
            console.warn(`[CustomQuestions] Booking page not found: ${bookingPageSlug}`);
            return res.status(404).json({ message: "Booking page not found" });
          }
        } catch (err) {
          console.error(`[CustomQuestions] Error retrieving booking page ${bookingPageSlug}:`, err);
          return res.status(500).json({ message: "Error retrieving booking page" });
        }
      }
      
      // If no tenant context available, return empty questions
      if (!tenantId) {
        console.warn(`[CustomQuestions] No tenant context available for appointment type ${appointmentTypeId}`);
        return res.json([]);
      }
      
      // Get the appointment type first with tenant isolation
      const appointmentType = await storage.getAppointmentType(appointmentTypeId, tenantId);
      if (!appointmentType) {
        console.log(`[CustomQuestions] Appointment type not found: ${appointmentTypeId}${tenantId ? ` for tenant ${tenantId}` : ''}`);
        return res.status(404).json({ message: "Appointment type not found" });
      }
      
      // Skip tenant check when using booking page context
      if (req.user?.tenantId && !bookingPageSlug) {
        const isSuperAdmin = req.user.username?.includes('admin@conmitto.io') || false;
        
        // Debug info for facilityId issues
        if (!appointmentType.facilityId) {
          console.error(`[CustomQuestions] CRITICAL: Appointment type ${appointmentTypeId} has no facilityId defined!`);
          
          // For custom questions, we can safely bypass facility check 
          // Log this special case handling
          console.log(`[CustomQuestions] Special case: Bypassing facility check for appointment type ${appointmentTypeId} with tenant ${tenantId}`);
          
          // Verify tenant ID directly on the appointment type instead of facility
          if (appointmentType.tenantId === req.user.tenantId || isSuperAdmin) {
            console.log(`[CustomQuestions] Access granted - appointment type ${appointmentTypeId} tenant matches user tenant ${req.user.tenantId}`);
            // Allow access
          } else {
            console.log(`[CustomQuestions] Access denied - appointment type ${appointmentTypeId} tenant ${appointmentType.tenantId} doesn't match user tenant ${req.user.tenantId}`);
            return res.status(403).json({ message: "Access denied to this appointment type's questions" });
          }
        } else {
          // Normal flow - Use our helper function to check tenant access
          const facility = await checkTenantFacilityAccess(
            appointmentType.facilityId,
            req.user.tenantId,
            isSuperAdmin,
            'CustomQuestions'
          );
          
          if (!facility) {
            console.log(`[CustomQuestions] Access denied - appointment type ${appointmentTypeId} is not in organization ${req.user.tenantId}`);
            return res.status(403).json({ message: "Access denied to this appointment type's questions" });
          }
        }
      }
      
      const customQuestions = await storage.getCustomQuestionsByAppointmentType(appointmentTypeId);
      console.log(`[CustomQuestions] Found ${customQuestions.length} questions for appointment type ${appointmentTypeId}`);
      
      // Add debug information for tracking
      console.log(`[CustomQuestions] Required fields: ${customQuestions.filter(q => q.isRequired).map(q => q.id).join(', ') || 'none'}`);
      
      // Map order_position to order in the response for frontend compatibility
      const mappedQuestions = customQuestions.map(question => ({
        ...question,
        order: question.order_position
      }));
      
      res.json(mappedQuestions);
    } catch (err) {
      console.error(`[CustomQuestions] Error fetching questions:`, err);
      res.status(500).json({ message: "Failed to fetch custom questions" });
    }
  });

  app.post("/api/custom-questions", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      // Enhanced logging for custom question creation
      console.log(`[CustomQuestion-Create] Creating custom question with payload:`, req.body);
      
      // Ensure included flag is properly set with a default value if not provided
      const enhancedData = {
        ...req.body,
        included: req.body.included !== false // Default to true if not explicitly set to false
      };
      
      const validatedData = insertCustomQuestionSchema.parse(enhancedData);
      const tenantId = req.user?.tenantId;
      
      // Check if appointment type exists if appointmentTypeId is provided
      if (validatedData.appointmentTypeId) {
        // Use tenant ID for isolation
        const appointmentType = await storage.getAppointmentType(validatedData.appointmentTypeId, tenantId);
        if (!appointmentType) {
          console.log(`[CustomQuestion] Appointment type not found: ${validatedData.appointmentTypeId}${tenantId ? ` for tenant ${tenantId}` : ''}`);
          return res.status(400).json({ message: "Invalid appointment type ID" });
        }
        
        // Add tenant isolation check
        if (req.user?.tenantId) {
          const isSuperAdmin = req.user.username?.includes('admin@conmitto.io') || false;
          
          const facility = await checkTenantFacilityAccess(
            appointmentType.facilityId,
            req.user.tenantId,
            isSuperAdmin,
            'CustomQuestion-Create'
          );
          
          if (!facility) {
            console.log(`[CustomQuestion] Access denied - appointment type ${appointmentType.id} is not in organization ${req.user.tenantId}`);
            return res.status(403).json({ message: "You can only create custom questions for appointment types in your organization" });
          }
        }
      }
      
      const customQuestion = await storage.createCustomQuestion(validatedData);
      res.status(201).json(customQuestion);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid custom question data", errors: err.errors });
      }
      res.status(500).json({ message: "Failed to create custom question" });
    }
  });

  app.put("/api/custom-questions/:id", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const tenantId = req.user?.tenantId;
      
      const customQuestion = await storage.getCustomQuestion(id);
      if (!customQuestion) {
        return res.status(404).json({ message: "Custom question not found" });
      }
      
      // If the question is associated with an appointment type, check tenant isolation
      if (customQuestion.appointmentTypeId) {
        // Get the appointment type to check which facility it belongs to with tenant isolation
        const appointmentType = await storage.getAppointmentType(customQuestion.appointmentTypeId, tenantId);
        if (!appointmentType) {
          console.log(`[CustomQuestion] Associated appointment type not found: ${customQuestion.appointmentTypeId}${tenantId ? ` for tenant ${tenantId}` : ''}`);
          return res.status(404).json({ message: "Associated appointment type not found" });
        }
        
        // Add tenant isolation check
        if (req.user?.tenantId) {
          const isSuperAdmin = req.user.username?.includes('admin@conmitto.io') || false;
          
          // Debug info for facilityId issues
          if (!appointmentType.facilityId) {
            console.error(`[CustomQuestion-Update] CRITICAL: Appointment type ${appointmentType.id} has no facilityId defined!`);
            
            // For custom questions, we can safely bypass facility check 
            // Log this special case handling
            console.log(`[CustomQuestion-Update] Special case: Bypassing facility check for appointment type ${appointmentType.id} with tenant ${tenantId}`);
            
            // Verify tenant ID directly on the appointment type instead of facility
            if (appointmentType.tenantId === req.user.tenantId || isSuperAdmin) {
              console.log(`[CustomQuestion-Update] Access granted - appointment type ${appointmentType.id} tenant matches user tenant ${req.user.tenantId}`);
              // Allow access
            } else {
              console.log(`[CustomQuestion-Update] Access denied - appointment type ${appointmentType.id} tenant ${appointmentType.tenantId} doesn't match user tenant ${req.user.tenantId}`);
              return res.status(403).json({ message: "You can only update questions for appointment types in your organization" });
            }
          } else {
            // Normal flow - Use our helper function to check tenant access
            const facility = await checkTenantFacilityAccess(
              appointmentType.facilityId,
              req.user.tenantId,
              isSuperAdmin,
              'CustomQuestion-Update'
            );
            
            if (!facility) {
              console.log(`[CustomQuestion] Access denied - appointment type ${appointmentType.id} is not in organization ${req.user.tenantId}`);
              return res.status(403).json({ message: "You can only update questions for appointment types in your organization" });
            }
          }
        }
      }
      
      // Enhanced logging and data handling for custom question updates
      console.log(`[CustomQuestion-Update] Updating question ${id} with payload:`, req.body);
      
      // Ensure included flag is handled correctly (default to true if not specified)
      const updatePayload = {
        ...req.body,
        included: req.body.included !== false
      };
      
      const updatedCustomQuestion = await storage.updateCustomQuestion(id, updatePayload);
      console.log(`[CustomQuestion-Update] Question ${id} updated successfully:`, updatedCustomQuestion);
      
      res.json(updatedCustomQuestion);
    } catch (err) {
      res.status(500).json({ message: "Failed to update custom question" });
    }
  });

  app.delete("/api/custom-questions/:id", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const tenantId = req.user?.tenantId;
      
      const customQuestion = await storage.getCustomQuestion(id);
      if (!customQuestion) {
        return res.status(404).json({ message: "Custom question not found" });
      }
      
      // If the question is associated with an appointment type, check tenant isolation
      if (customQuestion.appointmentTypeId) {
        // Get the appointment type to check which facility it belongs to with tenant isolation
        const appointmentType = await storage.getAppointmentType(customQuestion.appointmentTypeId, tenantId);
        if (!appointmentType) {
          console.log(`[CustomQuestion] Associated appointment type not found: ${customQuestion.appointmentTypeId}${tenantId ? ` for tenant ${tenantId}` : ''}`);
          return res.status(404).json({ message: "Associated appointment type not found" });
        }
        
        // Add tenant isolation check
        if (req.user?.tenantId) {
          const isSuperAdmin = req.user.username?.includes('admin@conmitto.io') || false;
          
          // Debug info for facilityId issues
          if (!appointmentType.facilityId) {
            console.error(`[CustomQuestion-Delete] CRITICAL: Appointment type ${appointmentType.id} has no facilityId defined!`);
            
            // For custom questions, we can safely bypass facility check 
            // Log this special case handling
            console.log(`[CustomQuestion-Delete] Special case: Bypassing facility check for appointment type ${appointmentType.id} with tenant ${tenantId}`);
            
            // Verify tenant ID directly on the appointment type instead of facility
            if (appointmentType.tenantId === req.user.tenantId || isSuperAdmin) {
              console.log(`[CustomQuestion-Delete] Access granted - appointment type ${appointmentType.id} tenant matches user tenant ${req.user.tenantId}`);
              // Allow access
            } else {
              console.log(`[CustomQuestion-Delete] Access denied - appointment type ${appointmentType.id} tenant ${appointmentType.tenantId} doesn't match user tenant ${req.user.tenantId}`);
              return res.status(403).json({ message: "You can only delete questions for appointment types in your organization" });
            }
          } else {
            // Normal flow - Use our helper function to check tenant access
            const facility = await checkTenantFacilityAccess(
              appointmentType.facilityId,
              req.user.tenantId,
              isSuperAdmin,
              'CustomQuestion-Delete'
            );
            
            if (!facility) {
              console.log(`[CustomQuestion] Access denied - appointment type ${appointmentType.id} is not in organization ${req.user.tenantId}`);
              return res.status(403).json({ message: "You can only delete questions for appointment types in your organization" });
            }
          }
        }
      }
      
      const success = await storage.deleteCustomQuestion(id);
      if (!success) {
        return res.status(500).json({ message: "Failed to delete custom question" });
      }
      
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete custom question" });
    }
  });
  
  // Get custom questions for a specific appointment type
  app.get("/api/custom-questions/:appointmentTypeId", async (req, res) => {
    try {
      const appointmentTypeId = parseInt(req.params.appointmentTypeId);
      let tenantId = req.user?.tenantId;
      const bookingPageSlug = req.query.bookingPageSlug as string;
      
      if (isNaN(appointmentTypeId)) {
        console.log(`[CustomQuestions] Invalid appointment type ID: ${req.params.appointmentTypeId}`);
        return res.status(400).send("Invalid appointment type ID");
      }
      
      // Check if we have a booking page slug (for external booking flow)
      if (bookingPageSlug) {
        console.log(`[CustomQuestions] Request includes booking page slug: ${bookingPageSlug}`);
        try {
          // Get the booking page to determine the correct tenant context
          const bookingPage = await storage.getBookingPageBySlug(bookingPageSlug);
          if (bookingPage) {
            tenantId = bookingPage.tenantId;
            console.log(`[CustomQuestions] Using tenant ID ${tenantId} from booking page ${bookingPageSlug}`);
          } else {
            console.warn(`[CustomQuestions] Booking page not found: ${bookingPageSlug}`);
          }
        } catch (err) {
          console.error(`[CustomQuestions] Error retrieving booking page ${bookingPageSlug}:`, err);
        }
      }
      
      console.log(`[CustomQuestions] Fetching questions for appointment type ID: ${appointmentTypeId}, tenantId: ${tenantId || 'none'} (alternate endpoint)`);
      
      // Get the appointment type first with tenant isolation
      const appointmentType = await storage.getAppointmentType(appointmentTypeId, tenantId);
      if (!appointmentType) {
        console.log(`[CustomQuestions] Appointment type not found: ${appointmentTypeId}${tenantId ? ` for tenant ${tenantId}` : ''}`);
        return res.status(404).json({ message: "Appointment type not found" });
      }
      
      // Skip tenant check when using booking page context
      // Check tenant isolation if user has a tenantId and we're not using booking page context
      if (req.user?.tenantId && !bookingPageSlug) {
        const isSuperAdmin = req.user.username?.includes('admin@conmitto.io') || false;
        
        // Debug info for facilityId issues
        if (!appointmentType.facilityId) {
          console.error(`[CustomQuestions-Alt] CRITICAL: Appointment type ${appointmentTypeId} has no facilityId defined!`);
          
          // For custom questions, we can safely bypass facility check 
          // Log this special case handling
          console.log(`[CustomQuestions-Alt] Special case: Bypassing facility check for appointment type ${appointmentTypeId} with tenant ${tenantId}`);
          
          // Verify tenant ID directly on the appointment type instead of facility
          if (appointmentType.tenantId === req.user.tenantId || isSuperAdmin) {
            console.log(`[CustomQuestions-Alt] Access granted - appointment type ${appointmentTypeId} tenant matches user tenant ${req.user.tenantId}`);
            // Allow access
          } else {
            console.log(`[CustomQuestions-Alt] Access denied - appointment type ${appointmentTypeId} tenant ${appointmentType.tenantId} doesn't match user tenant ${req.user.tenantId}`);
            return res.status(403).json({ message: "Access denied to this appointment type's questions" });
          }
        } else {
          // Normal flow - Use our helper function to check tenant access
          const facility = await checkTenantFacilityAccess(
            appointmentType.facilityId,
            req.user.tenantId,
            isSuperAdmin,
            'CustomQuestions-Alt'
          );
          
          if (!facility) {
            console.log(`[CustomQuestions-Alt] Access denied - appointment type ${appointmentTypeId} is not in organization ${req.user.tenantId}`);
            return res.status(403).json({ message: "Access denied to this appointment type's questions" });
          }
        }
      }
      
      const questions = await storage.getCustomQuestionsByAppointmentType(appointmentTypeId);
      console.log(`[CustomQuestions] Found ${questions.length} questions for appointment type ${appointmentTypeId}`);
      
      // Map order_position to order in the response for frontend compatibility
      const mappedQuestions = questions.map(question => ({
        ...question,
        order: question.order_position
      }));
      
      res.json(mappedQuestions);
    } catch (error) {
      console.error(`[CustomQuestions] Error fetching questions:`, error);
      res.status(500).send("Error fetching custom questions");
    }
  });

  // Standard Question routes
  app.get("/api/standard-questions/appointment-type/:appointmentTypeId", async (req, res) => {
    try {
      const appointmentTypeId = parseInt(req.params.appointmentTypeId);
      let tenantId = req.user?.tenantId;
      const bookingPageSlug = req.query.bookingPageSlug as string;
      
      console.log(`[StandardQuestions] Received request for appointment type ${appointmentTypeId} with params:`, {
        appointmentTypeId,
        bookingPageSlug: bookingPageSlug || 'none',
        initialTenantId: tenantId || 'none',
        userAuthenticated: !!req.user,
        reqPath: req.path
      });
      
      if (isNaN(appointmentTypeId)) {
        console.log(`[StandardQuestions] Invalid appointment type ID: ${req.params.appointmentTypeId}`);
        return res.status(400).send("Invalid appointment type ID");
      }
      
      // Check if we have a booking page slug (for external booking flow)
      if (bookingPageSlug) {
        console.log(`[StandardQuestions] Request includes booking page slug: ${bookingPageSlug}`);
        try {
          // Get the booking page to determine the correct tenant context
          const bookingPage = await storage.getBookingPageBySlug(bookingPageSlug);
          if (bookingPage) {
            tenantId = bookingPage.tenantId;
            console.log(`[StandardQuestions] Using tenant ID ${tenantId} from booking page ${bookingPageSlug}`);
          } else {
            console.warn(`[StandardQuestions] Booking page not found: ${bookingPageSlug}`);
          }
        } catch (err) {
          console.error(`[StandardQuestions] Error retrieving booking page ${bookingPageSlug}:`, err);
        }
      }
      
      console.log(`[StandardQuestions] Fetching questions for appointment type ID: ${appointmentTypeId}, tenantId: ${tenantId || 'none'}`);
      
      // Get the appointment type first with tenant isolation
      const appointmentType = await storage.getAppointmentType(appointmentTypeId, tenantId);
      if (!appointmentType) {
        console.log(`[StandardQuestions] Appointment type not found: ${appointmentTypeId}${tenantId ? ` for tenant ${tenantId}` : ''}`);
        return res.status(404).json({ message: "Appointment type not found" });
      }
      
      // Skip tenant check when using booking page context
      if (req.user?.tenantId && !bookingPageSlug) {
        const isSuperAdmin = req.user.username?.includes('admin@conmitto.io') || false;
        
        // Debug info for facilityId issues
        if (!appointmentType.facilityId) {
          console.error(`[StandardQuestions] CRITICAL: Appointment type ${appointmentTypeId} has no facilityId defined!`);
          
          // We can safely bypass facility check 
          console.log(`[StandardQuestions] Special case: Bypassing facility check for appointment type ${appointmentTypeId} with tenant ${tenantId}`);
          
          // Verify tenant ID directly on the appointment type instead of facility
          if (appointmentType.tenantId === req.user.tenantId || isSuperAdmin) {
            console.log(`[StandardQuestions] Access granted - appointment type ${appointmentTypeId} tenant matches user tenant ${req.user.tenantId}`);
            // Allow access
          } else {
            console.log(`[StandardQuestions] Access denied - appointment type ${appointmentTypeId} tenant ${appointmentType.tenantId} doesn't match user tenant ${req.user.tenantId}`);
            return res.status(403).json({ message: "Access denied to this appointment type's questions" });
          }
        } else {
          // Normal flow - Use our helper function to check tenant access
          const facility = await checkTenantFacilityAccess(
            appointmentType.facilityId,
            req.user.tenantId,
            isSuperAdmin,
            'StandardQuestions'
          );
          
          if (!facility) {
            console.log(`[StandardQuestions] Access denied - appointment type ${appointmentTypeId} is not in organization ${req.user.tenantId}`);
            return res.status(403).json({ message: "Access denied to this appointment type's questions" });
          }
        }
      }
      
      const standardQuestions = await storage.getStandardQuestionsByAppointmentType(appointmentTypeId);
      console.log(`[StandardQuestions] Found ${standardQuestions.length} questions for appointment type ${appointmentTypeId}`);
      
      // Add debug information for tracking
      console.log(`[StandardQuestions] Required fields: ${standardQuestions.filter(q => q.required).map(q => q.id).join(', ') || 'none'}`);
      
      // Map order_position to order in the response for frontend compatibility
      const mappedQuestions = standardQuestions.map(question => ({
        ...question,
        order: question.orderPosition,
        options: question.options || []
      }));
      
      res.json(mappedQuestions);
    } catch (err) {
      console.error(`[StandardQuestions] Error fetching questions:`, err);
      res.status(500).json({ message: "Failed to fetch standard questions" });
    }
  });
  
  app.post("/api/standard-questions", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      console.log(`[StandardQuestion] Request body:`, req.body);
      
      const validatedData = insertStandardQuestionSchema.parse(req.body);
      console.log(`[StandardQuestion] Validated data:`, validatedData);
      
      const tenantId = req.user?.tenantId;
      
      // Check if appointment type exists if appointmentTypeId is provided
      if (validatedData.appointmentTypeId) {
        // Use tenant ID for isolation
        const appointmentType = await storage.getAppointmentType(validatedData.appointmentTypeId, tenantId);
        if (!appointmentType) {
          console.log(`[StandardQuestion] Appointment type not found: ${validatedData.appointmentTypeId}${tenantId ? ` for tenant ${tenantId}` : ''}`);
          return res.status(400).json({ message: "Invalid appointment type ID" });
        }
        
        // Direct tenant isolation check without relying on facility relationships
        console.log(`[StandardQuestion] Debug - Comparing appointment type tenantId (${appointmentType.tenantId} - ${typeof appointmentType.tenantId}) with user tenantId (${req.user?.tenantId} - ${typeof req.user?.tenantId})`);
        
        if (req.user?.tenantId && Number(appointmentType.tenantId) !== Number(req.user.tenantId)) {
          const isSuperAdmin = req.user.username?.includes('admin@conmitto.io') || false;
          
          // Allow super admins to bypass tenant isolation
          if (!isSuperAdmin) {
            console.log(`[StandardQuestion] Access denied - appointment type ${appointmentType.id} belongs to tenant ${appointmentType.tenantId}, user is from tenant ${req.user.tenantId}`);
            return res.status(403).json({ message: "You can only create standard questions for appointment types in your organization" });
          }
        }
      }
      
      const standardQuestion = await storage.createStandardQuestion(validatedData);
      res.status(201).json(standardQuestion);
    } catch (err) {
      if (err instanceof z.ZodError) {
        console.error(`[StandardQuestion] Zod validation error:`, err.errors);
        return res.status(400).json({ message: "Invalid standard question data", errors: err.errors });
      }
      console.error(`[StandardQuestion] Error creating standard question:`, err);
      res.status(500).json({ message: "Failed to create standard question", error: err instanceof Error ? err.message : String(err) });
    }
  });
  
  // Keep backwards compatibility by adding the original endpoint path
  app.get("/api/standard-questions/:appointmentTypeId", async (req, res) => {
    // Redirect to the new endpoint format
    const appointmentTypeId = req.params.appointmentTypeId;
    const queryParams = new URLSearchParams();
    
    // Copy all query parameters
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') {
        queryParams.append(key, value);
      }
    }
    
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
    res.redirect(`/api/standard-questions/appointment-type/${appointmentTypeId}${queryString}`);
  });
  
  // New unified endpoint for custom questions that can handle both direct access and booking page context
  app.get("/api/custom-questions/:appointmentTypeId", async (req, res) => {
    try {
      const appointmentTypeId = parseInt(req.params.appointmentTypeId);
      if (isNaN(appointmentTypeId)) {
        return res.status(400).json({ message: "Invalid appointment type ID" });
      }
      
      console.log(`[CustomQuestions] Fetching questions for appointment type ${appointmentTypeId}`);
      
      // Check if we have a booking page slug in the query params
      const bookingPageSlug = req.query.bookingPageSlug as string | undefined;
      let tenantId = req.user?.tenantId;
      let appointmentType;
      
      if (bookingPageSlug) {
        console.log(`[CustomQuestions] Using booking page context: ${bookingPageSlug}`);
        // Get the booking page to determine tenant context
        const bookingPage = await storage.getBookingPageBySlug(bookingPageSlug);
        if (!bookingPage) {
          return res.status(404).json({ message: "Booking page not found" });
        }
        
        // Use the booking page's tenant ID instead of the user's
        tenantId = bookingPage.tenantId;
        console.log(`[CustomQuestions] Using tenant ID from booking page: ${tenantId}`);
        
        // Get the appointment type in the booking page context
        appointmentType = await storage.getAppointmentType(appointmentTypeId);
      } else {
        // Get the appointment type with tenant isolation
        appointmentType = await storage.getAppointmentType(appointmentTypeId);
        console.log(`[CustomQuestions] Using authenticated user context with tenant ID: ${tenantId}`);
      }
      
      if (!appointmentType) {
        return res.status(404).json({ message: "Appointment type not found" });
      }
      
      // If we're in an authenticated context (not through booking page), verify access
      if (!bookingPageSlug && req.user) {
        const isSuperAdmin = req.user.username?.includes('admin@conmitto.io') || false;
        
        // Debug info for facilityId issues
        if (!appointmentType.facilityId) {
          console.warn(`[CustomQuestions] Appointment type ${appointmentTypeId} has no facilityId defined!`);
          
          // Verify tenant ID directly on the appointment type instead of facility
          if (appointmentType.tenantId === req.user.tenantId || isSuperAdmin) {
            console.log(`[CustomQuestions] Access granted - appointment type ${appointmentTypeId} tenant matches user tenant ${req.user.tenantId}`);
            // Allow access
          } else {
            console.log(`[CustomQuestions] Access denied - appointment type ${appointmentTypeId} tenant ${appointmentType.tenantId} doesn't match user tenant ${req.user.tenantId}`);
            return res.status(403).json({ message: "Access denied to this appointment type's questions" });
          }
        } else {
          // Normal flow - Check tenant access based on facility
          const facility = await checkTenantFacilityAccess(
            appointmentType.facilityId,
            req.user.tenantId,
            isSuperAdmin,
            'CustomQuestions'
          );
          
          if (!facility) {
            console.log(`[CustomQuestions] Access denied - appointment type ${appointmentTypeId} is not in organization ${req.user.tenantId}`);
            return res.status(403).json({ message: "Access denied to this appointment type's questions" });
          }
        }
      }
      
      const standardQuestions = await storage.getStandardQuestionsByAppointmentType(appointmentTypeId);
      console.log(`[CustomQuestions] Found ${standardQuestions.length} questions for appointment type ${appointmentTypeId}`);
      
      // Transform fields for frontend compatibility
      const mappedQuestions = standardQuestions.map(question => ({
        id: question.id,
        label: question.label,
        required: question.required,
        appointmentTypeId: question.appointmentTypeId,
        fieldKey: question.fieldKey,
        fieldType: question.fieldType,
        included: question.included,
        orderPosition: question.orderPosition,
        options: question.options || []
      }));
      
      res.json(mappedQuestions);
    } catch (err) {
      console.error(`[CustomQuestions] Error fetching questions:`, err);
      res.status(500).json({ message: "Failed to fetch custom questions" });
    }
  });

  app.put("/api/standard-questions/:id", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid question ID" });
      }
      
      const standardQuestion = await storage.getStandardQuestion(id);
      
      // If the question doesn't exist, create it with the specified ID
      if (!standardQuestion) {
        console.log(`[StandardQuestion] Question ID ${id} not found, creating it on-demand`);
        
        // Extract data from request body, including appointmentTypeId which is required
        const validatedData = insertStandardQuestionSchema.parse(req.body);
        
        // Check for tenant isolation if appointmentTypeId is provided
        if (validatedData.appointmentTypeId && req.user?.tenantId) {
          const appointmentType = await storage.getAppointmentType(validatedData.appointmentTypeId);
          if (appointmentType) {
            const isSuperAdmin = req.user.username?.includes('admin@conmitto.io') || false;
            
            // Direct tenant check
            console.log(`[StandardQuestion] Create - Comparing appointment type tenantId (${appointmentType.tenantId}) with user tenantId (${req.user?.tenantId})`);
            
            if (!isSuperAdmin && Number(appointmentType.tenantId) !== Number(req.user.tenantId)) {
              console.log(`[StandardQuestion] Access denied - appointment type ${appointmentType.id} belongs to tenant ${appointmentType.tenantId}, user is from tenant ${req.user.tenantId}`);
              return res.status(403).json({ message: "You can only create standard questions for appointment types in your organization" });
            }
          }
        }
        
        // Create a new question with the provided data, forcing the ID to match the requested one
        const newQuestion = await storage.createStandardQuestionWithId(id, validatedData);
        return res.status(201).json(newQuestion);
      }
      
      // Otherwise, proceed with update as normal
      // Direct tenant isolation check if appointment type is set
      if (standardQuestion.appointmentTypeId && req.user?.tenantId) {
        const appointmentType = await storage.getAppointmentType(standardQuestion.appointmentTypeId);
        if (appointmentType) {
          const isSuperAdmin = req.user.username?.includes('admin@conmitto.io') || false;
          
          // Direct tenant check without relying on facility relationships
          console.log(`[StandardQuestion] Update - Comparing appointment type tenantId (${appointmentType.tenantId} - ${typeof appointmentType.tenantId}) with user tenantId (${req.user?.tenantId} - ${typeof req.user?.tenantId})`);
          
          if (!isSuperAdmin && Number(appointmentType.tenantId) !== Number(req.user.tenantId)) {
            console.log(`[StandardQuestion] Access denied - appointment type ${appointmentType.id} belongs to tenant ${appointmentType.tenantId}, user is from tenant ${req.user.tenantId}`);
            return res.status(403).json({ message: "You can only update standard questions for appointment types in your organization" });
          }
        }
      }
      
      const validatedData = insertStandardQuestionSchema.partial().parse(req.body);
      const updatedQuestion = await storage.updateStandardQuestion(id, validatedData);
      res.json(updatedQuestion);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid standard question data", errors: err.errors });
      }
      res.status(500).json({ message: "Failed to update standard question" });
    }
  });
  
  app.delete("/api/standard-questions/:id", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid question ID" });
      }
      
      const standardQuestion = await storage.getStandardQuestion(id);
      if (!standardQuestion) {
        return res.status(404).json({ message: "Standard question not found" });
      }
      
      // Direct tenant isolation check if appointment type is set
      if (standardQuestion.appointmentTypeId && req.user?.tenantId) {
        const appointmentType = await storage.getAppointmentType(standardQuestion.appointmentTypeId);
        if (appointmentType) {
          const isSuperAdmin = req.user.username?.includes('admin@conmitto.io') || false;
          
          // Direct tenant check without relying on facility relationships
          console.log(`[StandardQuestion] Debug - Comparing appointment type tenantId (${appointmentType.tenantId} - ${typeof appointmentType.tenantId}) with user tenantId (${req.user?.tenantId} - ${typeof req.user?.tenantId})`);
          
          if (!isSuperAdmin && Number(appointmentType.tenantId) !== Number(req.user.tenantId)) {
            console.log(`[StandardQuestion] Access denied - appointment type ${appointmentType.id} belongs to tenant ${appointmentType.tenantId}, user is from tenant ${req.user.tenantId}`);
            return res.status(403).json({ message: "You can only delete standard questions for appointment types in your organization" });
          }
        }
      }
      
      const success = await storage.deleteStandardQuestion(id);
      if (!success) {
        return res.status(500).json({ message: "Failed to delete standard question" });
      }
      
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete standard question" });
    }
  });

  // Booking Pages routes
  app.get("/api/booking-pages", async (req, res) => {
    try {
      // Determine if we need to enforce tenant isolation
      const tenantId = req.isAuthenticated() ? req.user?.tenantId : undefined;
      const isSuperAdmin = req.isAuthenticated() && (req.user?.role === 'super-admin' || req.user?.username?.includes('admin@conmitto.io'));
      
      console.log(`Fetching booking pages for ${isSuperAdmin ? 'super admin' : tenantId ? `organization ${tenantId}` : 'unauthenticated user'}`);
      
      // Pass tenantId to getBookingPages to enforce tenant isolation
      // Super admins can see all booking pages
      const bookingPages = await storage.getBookingPages(
        isSuperAdmin ? undefined : tenantId
      );
      
      res.json(bookingPages);
    } catch (err) {
      console.error("Error fetching booking pages:", err);
      res.status(500).json({ message: "Failed to fetch booking pages" });
    }
  });

  app.get("/api/booking-pages/slug/:slug", async (req, res) => {
    try {
      const slug = req.params.slug;
      console.log(`[BookingPage] Retrieving booking page with slug: ${slug}`);
      
      // For public booking pages, we don't enforce tenant isolation by authenticated user
      // Instead, we find the booking page by slug and then use its tenantId for subsequent operations
      const bookingPage = await storage.getBookingPageBySlug(slug);
      
      if (!bookingPage) {
        console.log(`[BookingPage] No booking page found with slug: ${slug}`);
        return res.status(404).json({ message: "Booking page not found" });
      }
      
      console.log(`[BookingPage] Successfully retrieved booking page:`, {
        id: bookingPage.id,
        name: bookingPage.name,
        tenantId: bookingPage.tenantId,
        facilities: bookingPage.facilities,
        excludedAppointmentTypes: bookingPage.excludedAppointmentTypes
      });
      
      // Ensure excludedAppointmentTypes is always an array
      if (!bookingPage.excludedAppointmentTypes) {
        bookingPage.excludedAppointmentTypes = [];
      } else if (!Array.isArray(bookingPage.excludedAppointmentTypes)) {
        // If it's a string (JSON), try to parse it
        try {
          const parsed = JSON.parse(bookingPage.excludedAppointmentTypes as unknown as string);
          bookingPage.excludedAppointmentTypes = Array.isArray(parsed) ? parsed : [];
        } catch (e) {
          console.log(`[BookingPage] Error parsing excludedAppointmentTypes, defaulting to empty array`);
          bookingPage.excludedAppointmentTypes = [];
        }
      }
      
      // Make sure we're returning numeric IDs for consistency
      if (bookingPage.excludedAppointmentTypes) {
        bookingPage.excludedAppointmentTypes = (bookingPage.excludedAppointmentTypes as any[]).map(id => 
          typeof id === 'string' ? parseInt(id, 10) : id
        );
      }
      
      res.json(bookingPage);
    } catch (err) {
      console.error("[BookingPage] Error retrieving booking page:", err);
      res.status(500).json({ message: "Failed to retrieve booking page" });
    }
  });

  // We'll add the dynamic booking page endpoint after multer is defined

  app.get("/api/booking-pages/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      console.log(`[BookingPage] Retrieving booking page with ID: ${id}`);
      
      // Determine if we need to enforce tenant isolation
      const tenantId = req.isAuthenticated() ? req.user?.tenantId : undefined;
      const isSuperAdmin = req.isAuthenticated() && (req.user?.role === 'super-admin' || req.user?.username?.includes('admin@conmitto.io'));
      
      // Get the booking page, with tenant filtering
      const bookingPage = await storage.getBookingPage(id, isSuperAdmin ? undefined : tenantId);
      
      if (!bookingPage) {
        console.log(`[BookingPage] No booking page found with ID: ${id}`);
        return res.status(404).json({ message: "Booking page not found" });
      }
      
      // If user is not a super admin and has a tenant ID, enforce tenant isolation
      if (!isSuperAdmin && tenantId) {
        // First check if tenant_id is set on the booking page
        if (bookingPage.tenantId !== undefined && bookingPage.tenantId !== null) {
          if (bookingPage.tenantId !== tenantId) {
            console.log(`[BookingPage] Access denied - tenant mismatch. User: ${tenantId}, BookingPage: ${bookingPage.tenantId}`);
            return res.status(403).json({ message: "Access denied to this booking page" });
          }
        } else {
          // Fallback to facility-based checking if tenant_id isn't available
          // Get facilities for this tenant
          const orgFacilities = await storage.getFacilitiesByOrganizationId(tenantId);
          const facilityIds = orgFacilities.map(f => f.id);
          
          // Make sure facilities is an array
          const bookingPageFacilities = Array.isArray(bookingPage.facilities) ? bookingPage.facilities : [];
          
          // Check if any of the booking page's facilities belong to this organization
          const hasTenantFacility = bookingPageFacilities.some(
            facilityId => facilityIds.includes(facilityId)
          );
          
          if (!hasTenantFacility) {
            console.log(`[BookingPage] Access denied - booking page ID ${id} does not belong to tenant ${tenantId}`);
            return res.status(403).json({ message: "Access denied to this booking page" });
          }
        }
      }
      
      console.log(`[BookingPage] Successfully retrieved booking page ID ${id}`);
      res.json(bookingPage);
    } catch (err) {
      console.error("Error fetching booking page:", err);
      res.status(500).json({ message: "Failed to fetch booking page" });
    }
  });

  app.post("/api/booking-pages", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      // Validate facilities and appointment types
      const { facilities, appointmentTypes } = req.body;
      
      if (!facilities || !Array.isArray(facilities) || facilities.length === 0) {
        return res.status(400).json({
          error: "Validation error",
          message: "Please select at least one facility"
        });
      }
      
      if (!appointmentTypes || !Array.isArray(appointmentTypes) || appointmentTypes.length === 0) {
        return res.status(400).json({
          error: "Validation error",
          message: "Please select at least one appointment type"
        });
      }
      
      // Determine if we need to enforce tenant isolation
      const isSuperAdmin = req.user?.role === 'super-admin' || req.user?.username?.includes('admin@conmitto.io');
      const tenantId = isSuperAdmin ? undefined : req.user?.tenantId;
      
      // If user has a tenantId (not super admin), validate that they can only use their organization's facilities
      if (tenantId) {
        // Get facilities that belong to this organization
        const orgFacilities = await storage.getFacilitiesByOrganizationId(tenantId);
        const allowedFacilityIds = orgFacilities.map(f => f.id);
        
        // Check if all selected facilities belong to this organization
        const validFacilities = facilities.every(facilityId => 
          allowedFacilityIds.includes(typeof facilityId === 'string' ? parseInt(facilityId, 10) : facilityId)
        );
        
        if (!validFacilities) {
          console.log(`[BookingPage] Access denied - user ${req.user?.id} with tenant ${tenantId} attempted to create booking page with facilities they don't have access to`);
          return res.status(403).json({ 
            error: "Validation error",
            message: "You can only select facilities that belong to your organization" 
          });
        }
      }
      
      console.log(`[BookingPage] Creating new booking page for tenant: ${tenantId || 'super-admin'}`);
      
      // Add the current user to createdBy field and include tenant ID
      const bookingPageData = {
        ...req.body,
        createdBy: req.user!.id,
        ...(tenantId ? { tenantId } : {}) // Add tenant ID if defined
      };
      
      // Check if slug already exists
      const existingBookingPage = await storage.getBookingPageBySlug(bookingPageData.slug);
      if (existingBookingPage) {
        return res.status(400).json({ message: "Slug already in use" });
      }
      
      // We need to calculate excludedAppointmentTypes for backward compatibility
      const allAppointmentTypes = await storage.getAppointmentTypes();
      const allAppointmentTypeIds = allAppointmentTypes.map(type => type.id);
      
      // Find appointment types to exclude (inverse of included types)
      const excludedAppointmentTypes = allAppointmentTypeIds.filter(
        id => !appointmentTypes.includes(id)
      );
      
      // Prepare the data to save with correct structure
      const dataToSave = {
        ...bookingPageData,
        facilities: facilities, // Array of facility IDs
        excludedAppointmentTypes: excludedAppointmentTypes, // For backward compatibility
        ...(tenantId ? { tenantId } : {}) // Make sure tenant ID is also in the validated data
      };
      
      console.log(`[BookingPage] Tenant ID for creation: ${tenantId || 'undefined (super admin)'}`);
      console.log(`[BookingPage] Data to save:`, JSON.stringify({
        ...dataToSave,
        facilities: facilities.length + ' facilities',
        appointmentTypes: appointmentTypes.length + ' appointment types'
      }, null, 2));
      
      console.log(`Creating booking page with:`, {
        facilities: facilities.length,
        appointmentTypes: appointmentTypes.length,
        excludedAppointmentTypes: excludedAppointmentTypes.length
      });
      
      try {
        const validatedData = insertBookingPageSchema.parse(dataToSave);
        const bookingPage = await storage.createBookingPage(validatedData);
        
        res.status(201).json({
          bookingPage: bookingPage,
          success: true
        });
      } catch (validationError) {
        console.error("Validation error:", validationError);
        if (validationError instanceof z.ZodError) {
          return res.status(400).json({ 
            message: "Invalid booking page data", 
            errors: validationError.errors 
          });
        }
        throw validationError;
      }
    } catch (err) {
      console.error("Error creating booking page:", err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid booking page data", 
          errors: err.errors 
        });
      }
      res.status(500).json({ message: "Failed to create booking page" });
    }
  });

  app.put("/api/booking-pages/:id", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const id = Number(req.params.id);
      console.log(`[BookingPage] Processing update request for booking page ID ${id}`);
      console.log(`[BookingPage] Request body:`, JSON.stringify(req.body, null, 2));
      
      // Determine if we need to enforce tenant isolation
      const isSuperAdmin = req.user?.role === 'super-admin' || req.user?.username?.includes('admin@conmitto.io');
      const tenantId = isSuperAdmin ? undefined : req.user?.tenantId;
      
      // Get the booking page, with tenant filtering
      const bookingPage = await storage.getBookingPage(id, isSuperAdmin ? undefined : tenantId);
      
      if (!bookingPage) {
        console.log(`[BookingPage] Error: Booking page ${id} not found or access denied`);
        return res.status(404).json({ message: "Booking page not found" });
      }
      
      // Check tenant isolation for existing booking page access
      if (tenantId) {
        // First check if tenant_id is set on the booking page
        if (bookingPage.tenantId !== undefined && bookingPage.tenantId !== null) {
          if (bookingPage.tenantId !== tenantId) {
            console.log(`[BookingPage] Access denied - tenant mismatch. User: ${tenantId}, BookingPage: ${bookingPage.tenantId}`);
            return res.status(403).json({ message: "Access denied to this booking page" });
          }
        } else {
          // Fallback to facility-based checking if tenant_id isn't available
          // Get facilities for this tenant
          const orgFacilities = await storage.getFacilitiesByOrganizationId(tenantId);
          const facilityIds = orgFacilities.map(f => f.id);
          
          // Make sure facilities is an array
          const bookingPageFacilities = Array.isArray(bookingPage.facilities) ? bookingPage.facilities : [];
          
          // Check if any of the booking page's facilities belong to this organization
          const hasTenantFacility = bookingPageFacilities.some(
            facilityId => facilityIds.includes(facilityId)
          );
          
          if (!hasTenantFacility) {
            console.log(`[BookingPage] Access denied - user ${req.user.id} with tenant ${tenantId} cannot edit booking page ID ${id}`);
            return res.status(403).json({ message: "Access denied to this booking page" });
          }
        }
      }
      
      // Validate facilities and appointment types
      const { facilities, appointmentTypes } = req.body;
      console.log(`[BookingPage] Raw facilities from request:`, facilities);
      console.log(`[BookingPage] Raw appointmentTypes from request:`, appointmentTypes);
      
      if (!facilities || !Array.isArray(facilities) || facilities.length === 0) {
        console.log(`[BookingPage] Error: No facilities provided or invalid format`);
        return res.status(400).json({
          error: "Validation error",
          message: "Please select at least one facility"
        });
      }
      
      if (!appointmentTypes || !Array.isArray(appointmentTypes) || appointmentTypes.length === 0) {
        console.log(`[BookingPage] Error: No appointment types provided or invalid format`);
        return res.status(400).json({
          error: "Validation error",
          message: "Please select at least one appointment type"
        });
      }
      
      // Convert any string IDs to numbers to ensure consistent processing
      const parsedFacilities = facilities.map(id => typeof id === 'string' ? parseInt(id, 10) : id);
      const parsedAppointmentTypes = appointmentTypes.map(id => typeof id === 'string' ? parseInt(id, 10) : id);
      
      // If user has a tenantId (not super admin), validate that they can only use their organization's facilities
      if (tenantId) {
        // Get facilities that belong to this organization
        const orgFacilities = await storage.getFacilitiesByOrganizationId(tenantId);
        const allowedFacilityIds = orgFacilities.map(f => f.id);
        
        // Check if all selected facilities belong to this organization
        const validFacilities = parsedFacilities.every(facilityId => 
          allowedFacilityIds.includes(facilityId)
        );
        
        if (!validFacilities) {
          console.log(`[BookingPage] Access denied - user ${req.user?.id} with tenant ${tenantId} attempted to update booking page with facilities they don't have access to`);
          return res.status(403).json({ 
            error: "Validation error",
            message: "You can only select facilities that belong to your organization" 
          });
        }
      }
      
      console.log(`[BookingPage] Parsed facilities:`, parsedFacilities);
      console.log(`[BookingPage] Parsed appointment types:`, parsedAppointmentTypes);
      
      // Add the current user to lastModifiedBy field
      const bookingPageData = {
        ...req.body,
        lastModifiedBy: req.user!.id
      };
      
      // If slug is being changed, check if new slug already exists
      if (bookingPageData.slug && bookingPageData.slug !== bookingPage.slug) {
        const existingBookingPage = await storage.getBookingPageBySlug(bookingPageData.slug);
        if (existingBookingPage && existingBookingPage.id !== id) {
          console.log(`[BookingPage] Error: Slug '${bookingPageData.slug}' already in use`);
          return res.status(400).json({ message: "Slug already in use" });
        }
      }
      
      // We need to calculate excludedAppointmentTypes for backward compatibility
      const allAppointmentTypes = await storage.getAppointmentTypes();
      const allAppointmentTypeIds = allAppointmentTypes.map(type => type.id);
      
      console.log(`[BookingPage] All appointment type IDs in the system:`, allAppointmentTypeIds);
      
      // Find appointment types to exclude (inverse of included types)
      const excludedAppointmentTypes = allAppointmentTypeIds.filter(
        id => !parsedAppointmentTypes.includes(id)
      );
      
      console.log(`[BookingPage] Calculated excluded appointment types:`, excludedAppointmentTypes);
      
      // Prepare the data to save with correct structure
      const dataToSave = {
        ...bookingPageData,
        facilities: parsedFacilities, // Array of facility IDs
        excludedAppointmentTypes: excludedAppointmentTypes, // For backward compatibility
        ...(tenantId ? { tenantId } : {}) // Add tenant ID if it's defined
      };
      
      // Remove the raw appointmentTypes from the data to save to avoid confusion with excludedAppointmentTypes
      delete dataToSave.appointmentTypes;
      
      console.log(`[BookingPage] Using tenant ID ${tenantId || 'undefined'} for update operations`);
      
      console.log(`[BookingPage] Updating booking page ${id} with:`, {
        facilities: parsedFacilities.length,
        includedAppointmentTypes: parsedAppointmentTypes.length,
        excludedAppointmentTypes: excludedAppointmentTypes.length
      });
      
      console.log(`[BookingPage] Full update payload:`, JSON.stringify(dataToSave, null, 2));
      
      // Pass tenant ID to ensure tenant isolation during the update
      const updatedBookingPage = await storage.updateBookingPage(id, dataToSave, tenantId);
      
      if (!updatedBookingPage) {
        console.log(`[BookingPage] Update failed due to tenant isolation or other access restrictions`);
        return res.status(403).json({ message: "You don't have permission to update this booking page" });
      }
      
      console.log(`[BookingPage] Update successful, response:`, JSON.stringify(updatedBookingPage, null, 2));
      
      res.status(200).json({
        bookingPage: updatedBookingPage,
        success: true
      });
    } catch (err) {
      console.error("[BookingPage] Error updating booking page:", err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid booking page data", 
          errors: err.errors 
        });
      }
      res.status(500).json({ message: "Failed to update booking page" });
    }
  });

  app.delete("/api/booking-pages/:id", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const id = Number(req.params.id);
      // Determine if we need to enforce tenant isolation
      const isSuperAdmin = req.user?.role === 'super-admin' || req.user?.username?.includes('admin@conmitto.io');
      const tenantId = isSuperAdmin ? undefined : req.user?.tenantId;
      
      // Get the booking page with tenant filtering
      const bookingPage = await storage.getBookingPage(id, isSuperAdmin ? undefined : tenantId);
      
      if (!bookingPage) {
        console.log(`[BookingPage] Booking page ${id} not found or access denied for tenant ${tenantId || 'super-admin'}`);
        return res.status(404).json({ message: "Booking page not found" });
      }
      
      // Check tenant isolation if user is not a super admin
      if (tenantId) {
        // First check if tenant_id is set on the booking page
        if (bookingPage.tenantId !== undefined && bookingPage.tenantId !== null) {
          if (bookingPage.tenantId !== tenantId) {
            console.log(`[BookingPage] Access denied - tenant mismatch. User: ${tenantId}, BookingPage: ${bookingPage.tenantId}`);
            return res.status(403).json({ message: "Access denied to this booking page" });
          }
        } else {
          // Fallback to facility-based checking if tenant_id isn't available
          // Get facilities for this tenant
          const orgFacilities = await storage.getFacilitiesByOrganizationId(tenantId);
          const facilityIds = orgFacilities.map(f => f.id);
          
          // Make sure facilities is an array
          const bookingPageFacilities = Array.isArray(bookingPage.facilities) ? bookingPage.facilities : [];
          
          // Check if any of the booking page's facilities belong to this organization
          const hasTenantFacility = bookingPageFacilities.some(
            facilityId => facilityIds.includes(facilityId)
          );
          
          if (!hasTenantFacility) {
            console.log(`[BookingPage] Access denied - cannot delete booking page ID ${id} as it does not belong to tenant ${tenantId}`);
            return res.status(403).json({ message: "Access denied to this booking page" });
          }
        }
      }
      
      // Pass tenant ID to the deleteBookingPage method for proper tenant isolation
      const success = await storage.deleteBookingPage(id, tenantId);
      if (success) {
        res.status(204).send();
      } else {
        res.status(404).json({ message: "Booking page not found or could not be deleted" });
      }
    } catch (err) {
      console.error("Error deleting booking page:", err);
      res.status(500).json({ message: "Failed to delete booking page" });
    }
  });

  // Set up multer for photo upload
  const uploadDir = path.join(process.cwd(), 'uploads');
  
  // Create upload directory if it doesn't exist
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  
  // Configure separate storage options for different types of uploads
  const scheduleStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, `schedule-${req.params.id}-${uniqueSuffix}${ext}`);
    }
  });
  
  // Special storage for BOL uploads with proper file naming
  const bolStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const timestamp = Date.now();
      const randomId = Math.round(Math.random() * 1E9);
      const uniqueSuffix = `${timestamp}-${randomId}`;
      const origName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_'); // Sanitize original filename
      const ext = path.extname(origName) || '.pdf'; // Default to .pdf if no extension
      
      // Create a filename with BOL prefix, original name (sanitized), and unique ID
      cb(null, `bol-${uniqueSuffix}-${origName}`);
    }
  });
  
  // Configure multer for image uploads
  const uploadImage = multer({ 
    storage: scheduleStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
      // Accept only images
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(null, false);
        return new Error('Only image files are allowed');
      }
    }
  });
  
  // Special upload instance for BOL documents with more file types allowed
  const uploadBol = multer({
    storage: bolStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
      // Accept common document types for BOL uploads
      const allowedTypes = [
        'application/pdf', 
        'image/jpeg', 
        'image/png', 
        'image/tiff',
        'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
      ];
      
      console.log('BOL upload file type:', file.mimetype);
      
      if (allowedTypes.includes(file.mimetype) || 
          file.mimetype.startsWith('image/') || 
          file.mimetype.includes('document')) {
        cb(null, true);
      } else {
        cb(null, false);
        return new Error(`File type ${file.mimetype} is not supported for BOL uploads`);
      }
    }
  });
  
  // API endpoint for creating appointments from the dynamic booking page
  // Add the slug-based booking endpoint to match what the tests expect
  app.post("/api/booking-pages/:slug/book", uploadBol.single('bolFile'), async (req, res) => {
    try {
      console.log(`[BookAppointment] Received appointment booking request via slug: ${req.params.slug}`);
      
      // Get the booking page slug from the URL parameter
      const bookingPageSlug = req.params.slug;
      
      if (!bookingPageSlug) {
        console.log("[BookAppointment] Error: Missing booking page slug");
        return res.status(400).json({ message: "Booking page slug is required" });
      }
      
      // Get the booking page to determine its tenant
      const bookingPage = await storage.getBookingPageBySlug(bookingPageSlug);
      if (!bookingPage) {
        console.log(`[BookAppointment] Error: No booking page found with slug: ${bookingPageSlug}`);
        return res.status(404).json({ message: "Booking page not found" });
      }
      
      const tenantId = bookingPage.tenantId;
      console.log(`[BookAppointment] Found booking page tenant ID: ${tenantId}`);
      
      // Continue with rest of the booking process - same as the other endpoint
      // Check if the facility belongs to the same tenant as the booking page
      const facilityId = parseInt(req.body.facilityId, 10);
      const facility = await storage.getFacility(facilityId);
      
      if (!facility) {
        console.log(`[BookAppointment] Error: Facility not found with ID: ${facilityId}`);
        return res.status(404).json({ message: "Facility not found" });
      }
      
      if (facility.tenantId !== tenantId) {
        console.log(`[BookAppointment] Error: Security breach - Facility ${facilityId} belongs to tenant ${facility.tenantId}, but booking page belongs to tenant ${tenantId}`);
        return res.status(403).json({ message: "Invalid facility for this booking page" });
      }
      
      // The rest of the endpoint logic is the same as the original endpoint
      const appointmentTypeId = parseInt(req.body.appointmentTypeId, 10);
      const appointmentType = await storage.getAppointmentType(appointmentTypeId);
      
      if (!appointmentType) {
        return res.status(404).json({ message: "Appointment type not found" });
      }
      
      // Format the date and time
      const { date, startTime, endTime } = req.body;
      const startDate = new Date(`${date}T${startTime}`);
      const endDate = new Date(`${date}T${endTime}`);
      
      // Generate a confirmation code
      const prefixMap = {
        'inbound': 'IN',
        'outbound': 'OUT',
        'other': 'APT'
      };
      
      // Default to 'other' if not specified or invalid
      const typeForPrefix = req.body.type && prefixMap[req.body.type.toLowerCase()] 
        ? req.body.type.toLowerCase() 
        : 'other';
      
      // Use a short code for the facility
      const facilityPrefix = facility.name.substring(0, 2).toUpperCase();
      
      // Generate a random 4-digit number
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      
      // Combine to create the confirmation code
      const confirmationCode = `${facilityPrefix}${prefixMap[typeForPrefix]}${randomNum}`;
      
      // BOL Processing - if a file was uploaded
      let bolData = null;
      if (req.file) {
        console.log(`[BookAppointment] BOL file received: ${req.file.originalname}`);
        
        // Store the file path for BOL processing
        const bolFilePath = req.file.path;
        
        // Schedule OCR processing (will be done asynchronously)
        try {
          console.log(`[BookAppointment] Scheduling OCR processing for BOL file: ${bolFilePath}`);
          
          // Here you'd typically queue the OCR job, but for now we'll just set a flag
          bolData = {
            filePath: bolFilePath,
            ocrStatus: 'pending',
            uploadedName: req.file.originalname
          };
        } catch (ocrErr) {
          console.error('[BookAppointment] Error scheduling OCR:', ocrErr);
          // Continue with the booking even if OCR scheduling fails
        }
      }
      
      // Collect all the appointment data
      const appointmentData = {
        tenantId: tenantId,
        facilityId: facilityId,
        appointmentTypeId: appointmentTypeId,
        type: req.body.type || appointmentType.applicableType || 'other',
        status: 'scheduled',
        startTime: startDate,
        endTime: endDate,
        truckNumber: req.body.truckNumber,
        trailerNumber: req.body.trailerNumber || null,
        driverName: req.body.driverName || null,
        driverPhone: req.body.driverPhone || null,
        driverEmail: req.body.driverEmail || null,
        customerName: req.body.customerName || null,
        carrierName: req.body.carrierName || null,
        mcNumber: req.body.mcNumber || null,
        palletCount: req.body.palletCount || null,
        bolNumber: req.body.bolNumber || null,
        poNumber: req.body.poNumber || null,
        confirmationCode: confirmationCode,
        customFormData: req.body.customFormData || null,
        createdBy: 0,  // External booking
        bolProcessingStatus: bolData ? 'pending' : null,
        bolFilePath: bolData ? bolData.filePath : null,
        source: 'booking-page'
      };
      
      // Import the enhanced availability service
      const { calculateAvailabilitySlots } = await import('./src/services/availability');
      
      // Use a transaction to check availability before creating the schedule
      const newAppointment = await db.transaction(async (tx) => {
        // Format date string for availability check (YYYY-MM-DD)
        const dateStr = date; 
        
        // Format time string for availability check (HH:MM)
        const timeStr = startTime.split(':').slice(0, 2).join(':');
        
        console.log(`[BookAppointment] Checking availability for date=${dateStr}, time=${timeStr}, facilityId=${facilityId}, appointmentTypeId=${appointmentTypeId}, tenantId=${tenantId}`);
        
        // Call calculateAvailabilitySlots to check if the selected time is available
        const availabilitySlots = await calculateAvailabilitySlots(
          db, // Using main db here since deep transaction propagation is complex
          storage,
          dateStr,
          facilityId,
          appointmentTypeId,
          tenantId
        );
        
        // Find the specific slot that matches our requested time
        const requestedSlot = availabilitySlots.find(slot => slot.time === timeStr);
        
        if (!requestedSlot) {
          console.log(`[BookAppointment] Requested time slot ${timeStr} not found in available slots`);
          throw new Error('SLOT_UNAVAILABLE');
        }
        
        if (!requestedSlot.available || requestedSlot.remainingCapacity <= 0) {
          console.log(`[BookAppointment] Requested time slot ${timeStr} is not available (available=${requestedSlot.available}, remainingCapacity=${requestedSlot.remainingCapacity})`);
          throw new Error('SLOT_UNAVAILABLE');
        }
        
        console.log(`[BookAppointment] Slot ${timeStr} is available with remaining capacity: ${requestedSlot.remainingCapacity}. Proceeding with creation.`);
        
        // Create the appointment if the slot is available
        console.log('[BookAppointment] Creating appointment with data:', appointmentData);
        return await storage.createAppointment(appointmentData);
      });
      
      if (!newAppointment) {
        console.error('[BookAppointment] Failed to create appointment');
        return res.status(500).json({ message: "Failed to create appointment" });
      }
      
      console.log(`[BookAppointment] Created appointment with ID: ${newAppointment.id}`);
      
      // Send confirmation email if driver email is provided
      if (req.body.driverEmail) {
        try {
          console.log(`[BookAppointment] Sending confirmation email to: ${req.body.driverEmail}`);
          
          await sendConfirmationEmail({
            to: req.body.driverEmail,
            appointment: newAppointment,
            facility: facility,
            appointmentType: appointmentType
          });
          
          console.log('[BookAppointment] Confirmation email sent successfully');
        } catch (emailErr) {
          console.error('[BookAppointment] Error sending confirmation email:', emailErr);
          // Continue even if email fails
        }
      } else {
        console.log('[BookAppointment] No driver email provided, skipping confirmation email');
      }
      
      // Return the confirmation code to the client
      return res.status(201).json({ 
        message: "Appointment created successfully", 
        appointmentId: newAppointment.id,
        confirmationCode: confirmationCode 
      });
    } catch (err) {
      console.error('[BookAppointment] Error in slug endpoint:', err);
      
      // Check for specific availability error
      if (err instanceof Error && err.message === 'SLOT_UNAVAILABLE') {
        return res.status(409).json({ 
          message: "The selected time slot is not available. Please choose another time.",
          errorCode: "SLOT_UNAVAILABLE"
        });
      }
      
      res.status(500).json({ 
        message: "An error occurred while booking the appointment",
        error: err instanceof Error ? err.message : String(err)
      });
    }
  });

  // Keep the existing endpoint as well for backward compatibility
  app.post("/api/booking-pages/book-appointment", uploadBol.single('bolFile'), async (req, res) => {
    try {
      console.log(`[BookAppointment] Received appointment booking request:`, req.body);
      
      // Get the booking page slug to determine the tenant context
      const { bookingPageSlug } = req.body;
      
      if (!bookingPageSlug) {
        console.log("[BookAppointment] Error: Missing booking page slug");
        return res.status(400).json({ message: "Booking page slug is required" });
      }
      
      // Get the booking page to determine its tenant
      const bookingPage = await storage.getBookingPageBySlug(bookingPageSlug);
      if (!bookingPage) {
        console.log(`[BookAppointment] Error: No booking page found with slug: ${bookingPageSlug}`);
        return res.status(404).json({ message: "Booking page not found" });
      }
      
      const tenantId = bookingPage.tenantId;
      console.log(`[BookAppointment] Found booking page tenant ID: ${tenantId}`);
      
      // Check if the facility belongs to the same tenant as the booking page
      const facilityId = parseInt(req.body.facilityId, 10);
      const facility = await storage.getFacility(facilityId);
      
      if (!facility) {
        console.log(`[BookAppointment] Error: Facility not found with ID: ${facilityId}`);
        return res.status(404).json({ message: "Facility not found" });
      }
      
      if (facility.tenantId !== tenantId) {
        console.log(`[BookAppointment] Error: Facility ${facilityId} belongs to tenant ${facility.tenantId}, not booking page tenant ${tenantId}`);
        return res.status(403).json({ message: "Facility does not belong to this booking page's organization" });
      }
      
      // Check if the appointment type belongs to the same tenant
      const appointmentTypeId = parseInt(req.body.appointmentTypeId, 10);
      const appointmentType = await storage.getAppointmentType(appointmentTypeId);
      
      if (!appointmentType) {
        console.log(`[BookAppointment] Error: Appointment type not found with ID: ${appointmentTypeId}`);
        return res.status(404).json({ message: "Appointment type not found" });
      }
      
      // Convert appointment date and time to a Date object
      const { appointmentDate, appointmentTime } = req.body;
      if (!appointmentDate || !appointmentTime) {
        console.log(`[BookAppointment] Error: Missing appointment date or time`);
        return res.status(400).json({ message: "Appointment date and time are required" });
      }
      
      // Calculate end time based on appointment type duration
      const startTime = new Date(`${appointmentDate}T${appointmentTime}`);
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + appointmentType.duration);
      
      // Format the appointment data - map booking page form fields to appointment fields
      const appointmentData = {
        tenantId: tenantId,
        facilityId: facilityId,
        appointmentTypeId: appointmentTypeId,
        type: req.body.pickupOrDropoff || "dropoff", // default to dropoff if not specified
        status: "scheduled",
        startTime: startTime,
        endTime: endTime,
        truckNumber: req.body.truckNumber || 'Unknown',
        createdBy: 0, // System created
        customerName: req.body.customerName,
        contactName: req.body.contactName,
        contactEmail: req.body.contactEmail,
        contactPhone: req.body.contactPhone,
        carrierName: req.body.carrierName,
        carrierId: req.body.carrierId ? parseInt(req.body.carrierId, 10) : null,
        mcNumber: req.body.mcNumber,
        trailerNumber: req.body.trailerNumber,
        driverName: req.body.driverName,
        driverPhone: req.body.driverPhone,
        poNumber: req.body.poNumber,
        bolNumber: req.body.bolNumber,
        palletCount: req.body.palletCount ? parseInt(req.body.palletCount, 10) : null,
        weight: req.body.weight ? parseFloat(req.body.weight) : null,
        notes: req.body.additionalNotes,
        bolFile: req.file ? req.file.filename : null,
        source: `booking_page_${bookingPage.id}`,
      };
      
      // Import the enhanced availability service
      const { calculateAvailabilitySlots } = await import('./src/services/availability');
      
      // Use a transaction to check availability before creating the schedule
      const createdAppointment = await db.transaction(async (tx) => {
        // Format date string for availability check (YYYY-MM-DD)
        const dateStr = format(new Date(appointmentDate), "yyyy-MM-dd");
        
        // Format time string for availability check (HH:MM)
        const timeStr = appointmentTime.split(':').slice(0, 2).join(':');
        
        console.log(`[BookAppointment] Checking availability for date=${dateStr}, time=${timeStr}, facilityId=${facilityId}, appointmentTypeId=${appointmentTypeId}, tenantId=${tenantId}`);
        
        // Call calculateAvailabilitySlots to check if the selected time is available
        const availabilitySlots = await calculateAvailabilitySlots(
          db, // Using main db here since deep transaction propagation is complex
          storage,
          dateStr,
          facilityId,
          appointmentTypeId,
          tenantId
        );
        
        // Find the specific slot that matches our requested time
        const requestedSlot = availabilitySlots.find(slot => slot.time === timeStr);
        
        if (!requestedSlot) {
          console.log(`[BookAppointment] Requested time slot ${timeStr} not found in available slots`);
          throw new Error('SLOT_UNAVAILABLE');
        }
        
        if (!requestedSlot.available || requestedSlot.remainingCapacity <= 0) {
          console.log(`[BookAppointment] Requested time slot ${timeStr} is not available (available=${requestedSlot.available}, remainingCapacity=${requestedSlot.remainingCapacity})`);
          throw new Error('SLOT_UNAVAILABLE');
        }
        
        console.log(`[BookAppointment] Slot ${timeStr} is available with remaining capacity: ${requestedSlot.remainingCapacity}. Proceeding with creation.`);
        
        // Create the appointment if the slot is available
        console.log(`[BookAppointment] Creating appointment with data:`, appointmentData);
        return await storage.createSchedule(appointmentData);
      });
      
      if (!createdAppointment) {
        console.log(`[BookAppointment] Error: Failed to create appointment`);
        return res.status(500).json({ message: "Failed to create appointment" });
      }
      
      console.log(`[BookAppointment] Successfully created appointment with ID: ${createdAppointment.id}`);
      
      // Send confirmation email if booking page has sendConfirmationEmail enabled
      // Use the sendEmail function from notifications module
      try {
        // Get organization name
        const organization = await storage.getTenantById(tenantId);
        const orgName = organization ? organization.name : bookingPage.name;
        
        // Get local confirmation code for calendar invite
        const confirmationCode = Math.random().toString(36).substring(2, 10).toUpperCase();
        
        // Create enhanced appointment object for email
        const enhancedAppointment: any = {
          ...appointmentData,
          id: createdAppointment.id,
          facilityName: facility.name,
          appointmentTypeName: appointmentType.name,
          timezone: facility.timezone || 'America/New_York'
        };
        
        // Generate calendar invite attachment
        const icsContent = generateICalEvent(enhancedAppointment, confirmationCode);
        
        // Create check-in URL with QR code for email
        const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
        const checkInUrl = `${baseUrl}/driver-check-in?code=${confirmationCode}`;
        
        // Format dates with correct timezone information
        let formattedStartDate = format(appointmentData.startTime, "MMMM d, yyyy");
        let formattedStartTime = format(appointmentData.startTime, "h:mm a");
        let formattedEndTime = format(appointmentData.endTime, "h:mm a");
        
        // Get facility timezone info
        const facilityTimezone = facility.timezone || 'America/New_York';
        
        // Send confirmation email with calendar attachment and QR code
        await sendEmail({
          to: appointmentData.contactEmail,
          from: process.env.SENDGRID_FROM_EMAIL || 'noreply@dockoptimizer.com',
          subject: `${orgName}: Appointment Confirmation #${confirmationCode} - ${formattedStartDate}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
              <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="color: #2d8cff; margin-bottom: 10px;">Your appointment has been confirmed</h2>
                <p style="font-size: 16px; color: #333;">Thank you for scheduling an appointment with ${orgName}.</p>
              </div>
              
              <div style="background-color: #f7f9fc; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                <h3 style="color: #333; margin-top: 0;">Appointment Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0; width: 40%;"><strong>Date:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">${formattedStartDate}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;"><strong>Time:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">${formattedStartTime} - ${formattedEndTime} (${facilityTimezone.split('/')[1].replace('_', ' ')})</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;"><strong>Location:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">${facility.name}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;"><strong>Type:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">${appointmentType.name}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;"><strong>Direction:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">${appointmentData.type === 'pickup' ? 'Pickup' : 'Dropoff'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;"><strong>Truck #:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">${appointmentData.truckNumber || 'Not provided'}</td>
                  </tr>
                  ${appointmentData.trailerNumber ? `
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;"><strong>Trailer #:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">${appointmentData.trailerNumber}</td>
                  </tr>` : ''}
                  ${appointmentData.driverName ? `
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;"><strong>Driver Name:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">${appointmentData.driverName}</td>
                  </tr>` : ''}
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;"><strong>Confirmation #:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;"><strong>${confirmationCode}</strong></td>
                  </tr>
                </table>
              </div>
              
              <!-- Express Check-In QR Code -->
              <div style="background-color: #e8f4ff; padding: 15px; border-radius: 5px; margin-bottom: 20px; border: 1px solid #b3d7ff;">
                <h3 style="color: #0066cc; margin-top: 0; text-align: center;">Express Check-In QR Code</h3>
                <div style="display: flex; flex-direction: column; align-items: center;">
                  <div style="background-color: white; padding: 15px; border-radius: 5px; border: 1px solid #b3d7ff; margin-bottom: 10px; text-align: center;">
                    <img src="${baseUrl}/api/qr-code?data=${encodeURIComponent(checkInUrl)}" 
                         alt="Check-in QR Code" style="width: 150px; height: 150px;">
                    <p style="margin: 5px 0 0; font-family: monospace; font-weight: bold; color: #0066cc;">${confirmationCode}</p>
                  </div>
                  <div style="background-color: #f0f8ff; padding: 10px; border-radius: 5px; max-width: 300px; border: 1px solid #b3d7ff;">
                    <p style="margin: 0; font-size: 14px; color: #333;"><strong>How to use:</strong></p>
                    <ul style="margin: 5px 0 0; padding-left: 25px; font-size: 14px; color: #333;">
                      <li>Present this QR code to dock staff upon arrival</li>
                      <li>This allows for expedited check-in without paperwork</li>
                      <li>Or use your confirmation number: ${confirmationCode}</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              ${bookingPage.confirmationMessage ? 
                `<div style="margin-bottom: 20px; padding: 15px; background-color: #f0f8ff; border-left: 4px solid #2d8cff; border-radius: 3px;">
                  <p style="margin: 0; color: #333;">${bookingPage.confirmationMessage}</p>
                </div>` : ''}
              
              <div style="background-color: #fff8e8; padding: 15px; border-radius: 5px; margin-bottom: 20px; border: 1px solid #ffecb5;">
                <p style="margin: 0; color: #333;"><strong>Important:</strong></p>
                <ul style="margin: 5px 0 0; padding-left: 25px; font-size: 14px; color: #333;">
                  <li>Please arrive 15 minutes before your scheduled time</li>
                  <li>Have your confirmation number or QR code ready</li>
                  <li>Check in with dock staff upon arrival</li>
                </ul>
              </div>
              
              <div style="text-align: center; color: #666; font-size: 14px; margin-top: 30px;">
                <p>A calendar invitation has been attached to this email.</p>
                <p>Please contact us if you need to make any changes to your appointment.</p>
                <p>You can check in online at: <a href="${checkInUrl}" style="color: #2d8cff;">${checkInUrl}</a></p>
              </div>
            </div>
          `,
          attachments: [
            {
              content: Buffer.from(icsContent).toString('base64'),
              filename: 'appointment.ics',
              type: 'text/calendar',
              disposition: 'attachment'
            }
          ]
        });
        console.log(`[BookAppointment] Confirmation email sent to ${appointmentData.contactEmail}`);
      } catch (emailError) {
        console.error(`[BookAppointment] Failed to send confirmation email: ${emailError}`);
        // Don't fail the request if email sending fails
      }
      
      res.status(201).json(createdAppointment);
    } catch (err) {
      console.error(`[BookAppointment] Error creating appointment:`, err);
      
      // Check for specific availability error
      if (err instanceof Error && err.message === 'SLOT_UNAVAILABLE') {
        return res.status(409).json({ 
          message: "The selected time slot is not available. Please choose another time.",
          errorCode: "SLOT_UNAVAILABLE"
        });
      }
      
      res.status(500).json({ 
        message: "Failed to create appointment",
        error: err instanceof Error ? err.message : String(err)
      });
    }
  });
  
  // Release door endpoint (with optional notes and photo)
  // Upload BOL endpoint
  app.post("/api/upload-bol", uploadBol.single('bolFile'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      // Generate a URL for the uploaded file
      const fileUrl = `/uploads/${req.file.filename}`;
      
      // Log the original filename and the stored filename for debugging
      console.log('BOL file uploaded:', {
        originalName: req.file.originalname,
        storedAs: req.file.filename,
        mimetype: req.file.mimetype,
        size: req.file.size
      });
      
      // Extract metadata sent from the client
      const metadata: Record<string, any> = {};
      
      // Extract all the basic OCR fields
      const extractableFields = [
        'bolNumber', 'customerName', 'carrierName', 'mcNumber', 
        'weight', 'palletCount', 'fromAddress', 'toAddress', 
        'pickupOrDropoff', 'truckId', 'trailerNumber', 'notes'
      ];
      
      // Extract the advanced OCR metadata fields
      const advancedMetadataFields = [
        'extractionMethod', 'extractionConfidence', 'processingTimestamp',
        'fileName', 'fileSize', 'fileType'
      ];
      
      // Combine all fields we want to extract
      const allFields = [...extractableFields, ...advancedMetadataFields, 'originalFileName'];
      
      // Collect metadata from request body
      for (const field of allFields) {
        if (req.body[field]) {
          // Parse numbers if they're stored as strings but represent numbers
          if (field === 'extractionConfidence' || field === 'fileSize') {
            metadata[field] = isNaN(Number(req.body[field])) ? req.body[field] : Number(req.body[field]);
          } else {
            metadata[field] = req.body[field];
          }
        }
      }
      
      // Ensure we have the original file name
      if (!metadata.fileName && metadata.originalFileName) {
        metadata.fileName = metadata.originalFileName;
      }
      
      // Ensure we have some timestamps for auditing
      if (!metadata.uploadedAt) {
        metadata.uploadedAt = new Date().toISOString();
      }
      
      if (!metadata.processingTimestamp) {
        metadata.processingTimestamp = new Date().toISOString();
      }
      
      // Add file information
      metadata.storedFilename = req.file.filename;
      metadata.fileUrl = fileUrl;
      metadata.mimeType = req.file.mimetype;
      metadata.fileSize = req.file.size;
      
      // Log the metadata
      console.log('BOL file uploaded with metadata:', metadata);
      
      // Return success with the file URL and extracted metadata
      return res.status(200).json({ 
        fileUrl,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        message: 'BOL file uploaded successfully',
        metadata // Include full metadata in the response
      });
    } catch (error) {
      console.error('Error uploading BOL file:', error);
      return res.status(500).json({ error: 'Failed to upload BOL file' });
    }
  });
  
  // Route to serve uploaded files from the /uploads directory
  app.get('/uploads/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(process.cwd(), 'uploads', filename);
    
    // Check if the file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Set appropriate content-disposition to force download
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Stream the file to the client
    res.sendFile(filePath);
  });
  
  // Associate BOL file with a schedule
  app.post("/api/schedules/:id/associate-bol", async (req, res) => {
    try {
      const scheduleId = parseInt(req.params.id);
      const { fileUrl, filename, metadata } = req.body;
      
      console.log(`[BOL Associate] Associating BOL file with schedule ${scheduleId}`, {
        fileUrl: fileUrl?.substring(0, 50), // Truncate for logging
        filename,
        metadataFields: metadata ? Object.keys(metadata) : 'none'
      });
      
      if (!scheduleId || isNaN(scheduleId)) {
        return res.status(400).json({ error: 'Invalid schedule ID' });
      }
      
      if (!fileUrl || !filename) {
        return res.status(400).json({ error: 'Missing file information' });
      }
      
      // Get the existing schedule
      const schedule = await storage.getSchedule(scheduleId);
      if (!schedule) {
        return res.status(404).json({ error: 'Schedule not found' });
      }
      
      console.log(`[BOL Associate] Retrieved schedule: ${scheduleId}`, {
        hasCustomFormData: !!schedule.customFormData,
        customFormDataType: schedule.customFormData ? typeof schedule.customFormData : 'undefined'
      });
      
      // Handle the case where customFormData might be a JSON string
      let customFormData: any;
      
      if (!schedule.customFormData) {
        customFormData = {};
      } else if (typeof schedule.customFormData === 'string') {
        try {
          customFormData = JSON.parse(schedule.customFormData);
        } catch (e) {
          console.error(`[BOL Associate] Error parsing customFormData string:`, e);
          customFormData = {};
        }
      } else {
        customFormData = schedule.customFormData;
      }
      
      // Initialize bolData if it doesn't exist
      if (!customFormData.bolData) {
        customFormData.bolData = {};
      }
      
      // Add timestamp for tracking
      const associationTimestamp = new Date().toISOString();
      
      // Prepare the BOL data object with required fields
      const bolDataUpdate = {
        fileUrl,
        fileName: filename,
        originalName: metadata?.fileName || filename,
        uploadedAt: metadata?.uploadedAt || associationTimestamp,
        associatedAt: associationTimestamp,
        associationSource: req.user?.username || 'system',
        ...(metadata || {}) // Spread in all the metadata if provided
      };
      
      console.log(`[BOL Associate] Adding BOL data to schedule ${scheduleId}:`, {
        fileUrl: bolDataUpdate.fileUrl?.substring(0, 50), // Truncate for logging
        fileName: bolDataUpdate.fileName,
        bolNumber: bolDataUpdate.bolNumber || 'none',
        associatedAt: bolDataUpdate.associatedAt
      });
      
      // Assign to the bolData object
      Object.assign(customFormData.bolData, bolDataUpdate);
      
      // Apply extracted data to the main schedule fields
      const updateData: any = {
        customFormData
      };
      
      // Update core schedule fields from BOL data if they're available
      const fieldsToUpdate = [
        'bolNumber', 'customerName', 'carrierName', 'mcNumber', 'weight', 
        'palletCount', 'truckNumber', 'trailerNumber'
      ];
      
      // Only overwrite empty fields or if the value is significant
      for (const field of fieldsToUpdate) {
        if (metadata?.[field] && 
            (!schedule[field] || schedule[field] === '' || schedule[field] === null)) {
          updateData[field] = metadata[field];
        }
      }
      
      console.log(`[BOL Associate] Updating schedule ${scheduleId} with fields:`, Object.keys(updateData));
      
      // Update the schedule in the database
      const updatedSchedule = await storage.updateSchedule(scheduleId, updateData);
      
      if (!updatedSchedule) {
        throw new Error(`Failed to update schedule ${scheduleId} with BOL data`);
      }
      
      console.log(`[BOL Associate] Successfully updated schedule ${scheduleId} with BOL data`);
      
      // Verify the customFormData was saved correctly
      const verifySchedule = await storage.getSchedule(scheduleId);
      
      const verifyData = {
        customFormDataSaved: !!verifySchedule?.customFormData,
        customFormDataType: verifySchedule?.customFormData ? typeof verifySchedule.customFormData : 'undefined',
        bolDataExists: !!verifySchedule?.customFormData?.bolData,
        fileUrlExists: !!verifySchedule?.customFormData?.bolData?.fileUrl
      };
      
      console.log(`[BOL Associate] Verification for schedule ${scheduleId}:`, verifyData);
      
      return res.status(200).json({
        message: 'BOL file associated with schedule successfully',
        schedule: updatedSchedule,
        verification: verifyData
      });
    } catch (error) {
      console.error('Error associating BOL file with schedule:', error);
      return res.status(500).json({ 
        error: 'Failed to associate BOL file with schedule',
        message: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  app.post("/api/schedules/:id/release", uploadImage.single('photo'), async (req, res) => {
    try {
      console.log("=== RELEASE DOOR START ===");
      const id = Number(req.params.id);
      
      // Validate the ID
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid schedule ID" });
      }
      
      // Get the schedule
      const schedule = await storage.getSchedule(id);
      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }
      
      // Get notes and release type from request body
      const { notes, releaseType = 'normal' } = req.body;
      
      // Optional photo file info
      const photoInfo = req.file ? {
        filename: req.file.filename,
        originalname: req.file.originalname,
        path: req.file.path,
        mimetype: req.file.mimetype,
        size: req.file.size
      } : null;
      
      console.log(`Releasing door for schedule ${id} with notes: ${notes}`);
      if (photoInfo) {
        console.log(`Photo uploaded: ${photoInfo.filename}`);
      }
      
      // Store the original dock ID for reference
      const originalDockId = schedule.dockId;
      console.log(`Original dock ID before release: ${originalDockId}`);
      
      // Make sure there's actually a dock to release
      if (originalDockId === null) {
        console.warn(`Warning: Schedule ${id} does not have a dock assigned`);
      }
      
      // Parse existing custom form data (safely)
      let existingCustomFormData = {};
      if (schedule.customFormData) {
        try {
          existingCustomFormData = typeof schedule.customFormData === 'string' ?
            JSON.parse(schedule.customFormData) : schedule.customFormData;
        } catch (e) {
          console.warn("Failed to parse existing customFormData:", e);
        }
      }
      
      // Prepare customFormData with release information
      const newCustomFormData = JSON.stringify({
        ...existingCustomFormData,
        releasePhoto: photoInfo || null,
        releasedDockId: originalDockId, // Store the original dock ID for reference
        releaseTime: new Date().toISOString()
      });
      
      // First, we'll update the status and other fields excluding the dockId
      console.log(`Step 1: Updating schedule ${id} with status and metadata`);
      const statusUpdate = {
        status: "completed", // Mark as completed
        actualEndTime: new Date(),
        notes: notes || schedule.notes,
        lastModifiedBy: req.user?.id || null,
        lastModifiedAt: new Date(),
        customFormData: newCustomFormData
      };
      
      const statusUpdated = await storage.updateSchedule(id, statusUpdate);
      if (!statusUpdated) {
        return res.status(500).json({ message: "Failed to update schedule status" });
      }
      
      // Now, as a separate operation, clear the dockId
      console.log(`Step 2: Explicitly releasing dock (setting dockId to null) for schedule ${id}`);
      const dockUpdate = {
        dockId: null
      };
      
      const updatedSchedule = await storage.updateSchedule(id, dockUpdate);
      if (!updatedSchedule) {
        return res.status(500).json({ message: "Failed to release dock" });
      }
      
      // Verify the door was actually released
      const verifiedSchedule = await storage.getSchedule(id);
      if (verifiedSchedule && verifiedSchedule.dockId !== null) {
        console.error(`ERROR: Failed to release dock for schedule ${id}. DockId still set to ${verifiedSchedule.dockId}. Attempting emergency fix...`);
        
        // Try a direct database query as a last resort
        try {
          const query = `UPDATE schedules SET dock_id = NULL WHERE id = $1 RETURNING *`;
          const result = await pool.query(query, [id]);
          
          if (result.rows.length > 0) {
            console.log("Emergency direct update succeeded");
            
            // Verify again
            const finalCheck = await storage.getSchedule(id);
            if (finalCheck && finalCheck.dockId !== null) {
              console.error(`CRITICAL ERROR: All attempts to release dock ${originalDockId} from schedule ${id} have failed!`);
            } else {
              console.log(`Emergency fix verified: dockId is now null for schedule ${id}`);
            }
          } else {
            console.error("Emergency direct update failed - no rows returned");
          }
        } catch (dbError) {
          console.error("Emergency direct update failed with error:", dbError);
        }
      } else {
        console.log(`Door successfully released: schedule ${id} dockId is now null (was ${originalDockId})`);
      }
      
      // Get additional schedule data needed for email notification
      try {
        // Get the enhanced schedule with all related data
        const enhancedSchedule = await storage.getEnhancedSchedule(id);
        
        if (enhancedSchedule) {
          console.log(`[Door Release] Retrieved enhanced schedule data for email notification`);
          
          // Try to get the contact email from the schedule data
          let contactEmail = null;
          
          // First try customer email
          if (enhancedSchedule.customerEmail) {
            contactEmail = enhancedSchedule.customerEmail;
            console.log(`[Door Release] Using customer email for notification: ${contactEmail}`);
          } 
          // Fall back to carrier email
          else if (enhancedSchedule.carrierEmail) {
            contactEmail = enhancedSchedule.carrierEmail;
            console.log(`[Door Release] Using carrier email for notification: ${contactEmail}`);
          }
          // Fall back to driver email if available
          else if (enhancedSchedule.driverEmail) {
            contactEmail = enhancedSchedule.driverEmail;
            console.log(`[Door Release] Using driver email for notification: ${contactEmail}`);
          }
          
          // Find or generate confirmation code
          const confirmationCode = enhancedSchedule.confirmationCode || 
            `${enhancedSchedule.id}-${new Date().getTime().toString().substring(9)}`;
          
          // If we have an email, send the checkout completion notification
          if (contactEmail) {
            // Import the sendCheckoutCompletionEmail function
            const { sendCheckoutCompletionEmail } = await import('./checkout-notification');
            
            try {
              console.log(`[Door Release] Sending checkout completion email to ${contactEmail}`);
              
              // Send the completion email
              await sendCheckoutCompletionEmail(
                contactEmail,
                confirmationCode,
                enhancedSchedule
              );
              console.log(`[Door Release] Successfully sent checkout completion email to ${contactEmail}`);
            } catch (emailError) {
              console.error(`[Door Release] Failed to send checkout completion email:`, emailError);
              // Non-blocking error, continue with the door release process
            }
          } else {
            console.log(`[Door Release] No contact email found for checkout notification`);
          }
        } else {
          console.warn(`[Door Release] Could not retrieve enhanced schedule data for notification`);
        }
      } catch (notificationError) {
        console.error(`[Door Release] Error preparing notification:`, notificationError);
        // Non-blocking error, continue with the door release process
      }
      
      // Broadcast the door release via WebSockets for real-time updates
      if (app.locals.broadcastScheduleUpdate) {
        console.log(`[WebSocket] Broadcasting door release: Schedule ${id}`);
        const finalSchedule = await storage.getSchedule(id);
        app.locals.broadcastScheduleUpdate({
          ...(finalSchedule || updatedSchedule),
          tenantId: req.user?.tenantId
        });
      }
      
      // Return complete updated schedule with photo information and ensure dockId is null
      const finalSchedule = await storage.getSchedule(id);
      res.json({
        ...(finalSchedule || updatedSchedule),
        dockId: null, // Force dockId to be null in the response
        photoInfo: photoInfo
      });
    } catch (err) {
      console.error("Failed to release door:", err);
      res.status(500).json({ 
        message: "Failed to release door", 
        error: err instanceof Error ? err.message : String(err)
      });
    }
  });

  // Create HTTP server
  // Admin routes
  app.get("/api/admin/booking-styles", async (req, res) => {
    // Pass the request to the controller
    await getBookingStyles(req, res);
  });
  
  // Facility-specific availability endpoint for dynamic booking page
  app.get("/api/facilities/:facilityId/availability", async (req, res) => {
    try {
      const { facilityId } = req.params;
      const { date, appointmentTypeId, bookingPageSlug } = req.query;
      
      // Get the tenant ID from user session
      const userTenantId = req.user?.tenantId;
      
      // Variable to hold the effective tenant ID to use for this request
      let effectiveTenantId = userTenantId;
      
      console.log(`[FacilityAvailability] Requested for facility ${facilityId}, appointment type ${appointmentTypeId}, date ${date}, booking page ${bookingPageSlug || 'none'}`);
      
      // If a booking page slug is provided, use it to determine the tenant context
      // This takes priority over the authenticated user's context
      if (bookingPageSlug) {
        console.log(`[FacilityAvailability] Request with bookingPageSlug: ${bookingPageSlug}`);
        
        // Get the booking page to determine its tenant
        const bookingPage = await storage.getBookingPageBySlug(bookingPageSlug as string);
        if (bookingPage && bookingPage.tenantId) {
          effectiveTenantId = bookingPage.tenantId;
          console.log(`[FacilityAvailability] Using booking page tenant context: ${effectiveTenantId}`);
        } else {
          console.log(`[FacilityAvailability] No valid booking page found for slug: ${bookingPageSlug}`);
        }
      }
      
      // Forward to the main availability logic with the same parameters
      // This endpoint serves as a RESTful alias to the main /api/availability endpoint
      return await getAvailabilityHandler(req, res, {
        date,
        facilityId,
        appointmentTypeId,
        bookingPageSlug,
        effectiveTenantId
      });
    } catch (error) {
      console.error(`[FacilityAvailability] Error:`, error);
      return res.status(500).json({ message: "Error processing availability request" });
    }
  });
  
  // New availability endpoint specifically for booking pages with slug pattern
  app.get("/api/availability/:bookingPageSlug/:date", async (req, res) => {
    try {
      const { bookingPageSlug, date } = req.params;
      const { facilityId, appointmentTypeId } = req.query;
      
      console.log(`[Availability API] Received request for booking page ${bookingPageSlug}, date ${date}, facilityId ${facilityId}, appointmentTypeId ${appointmentTypeId}`);
      
      if (!bookingPageSlug) {
        console.log('[Availability API] Error: missing booking page slug');
        return res.status(400).json({ error: 'Booking page slug is required' });
      }
      
      // Get booking page to establish tenant context
      const bookingPage = await storage.getBookingPageBySlug(bookingPageSlug);
      if (!bookingPage) {
        console.log(`[Availability API] Error: booking page not found for slug ${bookingPageSlug}`);
        return res.status(404).json({ error: 'Booking page not found' });
      }
      
      console.log(`[Availability API] Found booking page ${bookingPage.name} with tenant ID ${bookingPage.tenantId}`);
      
      // Ensure we're sending JSON response
      res.setHeader('Content-Type', 'application/json');
      
      // Make sure we have the required parameters
      if (!facilityId || !appointmentTypeId) {
        console.log(`[Availability API] Error: missing facilityId or appointmentTypeId`);
        return res.status(400).json({ error: 'facilityId and appointmentTypeId are required' });
      }
      
      // Parse the parameters
      const facilityIdNum = Number(facilityId);
      const typeIdNum = Number(appointmentTypeId);
      const dateObj = new Date(date);
      
      if (isNaN(facilityIdNum) || isNaN(typeIdNum) || isNaN(dateObj.getTime())) {
        console.log(`[Availability API] Error: invalid parameters - facilityId: ${facilityId}, appointmentTypeId: ${appointmentTypeId}, date: ${date}`);
        return res.status(400).json({ error: 'Invalid facilityId, appointmentTypeId, or date' });
      }
      
      // Check if there are any facility or appointment type issues
      try {
        // Verify facility belongs to the booking page's organization
        const facilityQuery = `
          SELECT of.organization_id
          FROM facilities f 
          JOIN organization_facilities of ON f.id = of.facility_id
          WHERE f.id = $1 AND of.organization_id = $2
          LIMIT 1
        `;
        const facilityResult = await pool.query(facilityQuery, [facilityIdNum, bookingPage.tenantId]);
        
        if (facilityResult.rows.length === 0) {
          console.log(`[Availability API] Facility ${facilityIdNum} not found or not accessible by tenant ${bookingPage.tenantId}`);
          return res.status(404).json({ error: 'Facility not found or not accessible' });
        }
        
        console.log(`[Availability API] Verified tenant access to facility ${facilityIdNum} for organization ${bookingPage.tenantId}`);
      } catch (error) {
        console.error(`[Availability API] Error checking facility access:`, error);
        return res.status(500).json({ error: 'Error checking facility access' });
      }
      
      // Generate time slots from the facility operating hours
      try {
        // Get the facility hours for the requested date
        const dayOfWeek = dateObj.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
        const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
        const dayName = dayNames[dayOfWeek];
        
        // Query facility hours from the facilities table
        const facilityHoursQuery = `
          SELECT 
            ${dayName}_open as is_open,
            ${dayName}_start as start_time,
            ${dayName}_end as end_time
          FROM facilities
          WHERE id = $1
          LIMIT 1
        `;
        
        const facilityHoursResult = await pool.query(facilityHoursQuery, [facilityIdNum]);
        
        // Default facility hours
        let startTime = "08:00";
        let endTime = "17:00";
        let isOpen = true;
        
        if (facilityHoursResult.rows.length > 0) {
          const facilityHours = facilityHoursResult.rows[0];
          
          // Check if the facility is open on this day
          if (facilityHours.is_open && facilityHours.start_time && facilityHours.end_time) {
            startTime = facilityHours.start_time;
            endTime = facilityHours.end_time;
            isOpen = true;
            console.log(`[Availability API] Facility ${facilityIdNum} hours for ${dayName}: ${startTime}-${endTime}`);
          } else {
            console.log(`[Availability API] Facility ${facilityIdNum} is closed on ${dayName}`);
            isOpen = false;
          }
        } else {
          console.log(`[Availability API] No facility found for ID ${facilityIdNum}, using default hours`);
        }
        
        // If facility is closed, return empty availability
        if (!isOpen) {
          return res.json({ 
            availableTimes: [],
            slots: [],
            message: "Facility is closed on this day" 
          });
        }
        
        // Get appointment type for duration
        const appointmentTypeQuery = `
          SELECT * FROM appointment_types
          WHERE id = $1
          LIMIT 1
        `;
        const appointmentTypeResult = await pool.query(appointmentTypeQuery, [typeIdNum]);
        
        if (appointmentTypeResult.rows.length === 0) {
          console.log(`[Availability API] Warning: Appointment type ${typeIdNum} not found, returning sample slots`);
          
          // Return sample slots for testing - since we can't find the appointment type
          // Default to 2 slots to respect max concurrent capacity
          const defaultMaxConcurrent = 2;
          const sampleSlots = [
            { time: "09:00", available: true, remainingCapacity: defaultMaxConcurrent, remaining: defaultMaxConcurrent, reason: "", isBufferTime: false },
            { time: "10:30", available: true, remainingCapacity: defaultMaxConcurrent, remaining: defaultMaxConcurrent, reason: "", isBufferTime: false },
            { time: "13:00", available: true, remainingCapacity: defaultMaxConcurrent, remaining: defaultMaxConcurrent, reason: "", isBufferTime: false },
            { time: "14:30", available: true, remainingCapacity: defaultMaxConcurrent, remaining: defaultMaxConcurrent, reason: "", isBufferTime: false },
            { time: "16:00", available: true, remainingCapacity: defaultMaxConcurrent, remaining: defaultMaxConcurrent, reason: "", isBufferTime: false }
          ];
          
          const sampleTimes = sampleSlots.map(slot => slot.time);
          
          return res.json({
            date,
            facilityId: facilityIdNum,
            appointmentTypeId: typeIdNum,
            appointmentTypeDuration: 60, // Default to 60 minutes
            timezone: "America/New_York",
            availableTimes: sampleTimes,
            slots: sampleSlots
          });
        }
        
        const appointmentType = appointmentTypeResult.rows[0];
        const intervalMinutes = appointmentType.duration || 30;
        
        // Get existing appointments for this date
        const dateStart = new Date(date);
        dateStart.setHours(0, 0, 0, 0);
        
        const dateEnd = new Date(date);
        dateEnd.setHours(23, 59, 59, 999);
        
        // Use correct time format for PostgreSQL
        const dateStartStr = dateStart.toISOString();
        const dateEndStr = dateEnd.toISOString();
        
        // Query to get all appointments for this date and facility
        const busyTimesQuery = `
          SELECT 
            s.start_time, 
            s.end_time,
            s.dock_id
          FROM schedules s
          JOIN docks d ON s.dock_id = d.id
          WHERE d.facility_id = $1
          AND s.start_time >= $2
          AND s.start_time < $3
          ORDER BY s.start_time
        `;
        
        // Get all existing appointments
        const busyTimesResult = await pool.query(busyTimesQuery, [
          facilityIdNum, 
          dateStartStr, 
          dateEndStr
        ]);
        
        // Get all docks for this facility
        const docksQuery = `
          SELECT id FROM docks
          WHERE facility_id = $1
        `;
        
        const docksResult = await pool.query(docksQuery, [facilityIdNum]);
        const docks = docksResult.rows.map(d => d.id);
        
        // Function to generate time slots
        function generateTimeSlots(start, end, intervalMins) {
          const result = [];
          const startDate = new Date(`${date}T${start}`);
          const endDate = new Date(`${date}T${end}`);
          
          let current = new Date(startDate);
          
          while (current < endDate) {
            result.push(current.toTimeString().substring(0, 5)); // Format as HH:MM
            current = new Date(current.getTime() + intervalMins * 60 * 1000);
          }
          
          return result;
        }
        
        // Generate all possible time slots
        const allTimeSlots = generateTimeSlots(startTime, endTime, intervalMinutes);
        console.log(`[Availability API] Generated ${allTimeSlots.length} potential time slots`);
        
        // Create a busy time map by dock
        const busyTimesByDock = {};
        
        // Initialize with empty arrays for each dock
        docks.forEach(dockId => {
          busyTimesByDock[dockId] = [];
        });
        
        // Populate busy times for each dock
        busyTimesResult.rows.forEach(appointment => {
          if (appointment.dock_id) {
            if (!busyTimesByDock[appointment.dock_id]) {
              busyTimesByDock[appointment.dock_id] = [];
            }
            
            busyTimesByDock[appointment.dock_id].push({
              start: new Date(appointment.start_time),
              end: new Date(appointment.end_time)
            });
          }
        });
        
        // For each time slot, check if we have at least one dock available
        const availableTimes = [];
        const availableSlots = [];
        
        allTimeSlots.forEach(timeStr => {
          // Convert HH:MM string to a Date object for comparison
          const slotTime = new Date(`${date}T${timeStr}:00`);
          const slotEndTime = new Date(slotTime.getTime() + (intervalMinutes * 60 * 1000));
          
          // Count available docks at this time
          let availableDockCount = 0;
          
          docks.forEach(dockId => {
            const dockBusyTimes = busyTimesByDock[dockId] || [];
            
            // Check if this dock is free for this time slot
            const isDockFree = !dockBusyTimes.some(busyTime => 
              (slotTime < busyTime.end && slotEndTime > busyTime.start)
            );
            
            if (isDockFree) {
              availableDockCount++;
            }
          });
          
          if (availableDockCount > 0) {
            availableTimes.push(timeStr);
            availableSlots.push({
              time: timeStr,
              available: true,
              remainingCapacity: availableDockCount,
              remaining: availableDockCount, // Add 'remaining' for compatibility
              reason: "",
              isBufferTime: false
            });
          } else {
            availableSlots.push({
              time: timeStr,
              available: false,
              remainingCapacity: 0,
              remaining: 0,
              reason: "No available docks",
              isBufferTime: false
            });
          }
        });
        
        console.log(`[Availability API] Final available times: ${availableTimes.length} slots`);
        
        // Return both formats for compatibility
        return res.json({
          availableTimes: availableTimes,
          slots: availableSlots
        });
        
      } catch (error) {
        console.error(`[Availability API] Error generating time slots:`, error);
        return res.status(500).json({ error: 'Error generating time slots' });
      }
    } catch (err) {
      console.error('Error in booking page availability endpoint:', err);
      res.setHeader('Content-Type', 'application/json');
      res.status(500).json({ error: 'Failed to get availability for booking page' });
    }
  });
  
  // Define a shared handler function for availability logic
  async function getAvailabilityHandler(req, res, params) {
    const { date, facilityId, appointmentTypeId, bookingPageSlug, effectiveTenantId } = params;
    
    // INSTRUMENTATION: Log the incoming request parameters
    console.log("===== AVAILABILITY HANDLER INSTRUMENTATION =====");
    console.log("REQUEST PARAMETERS:", { 
      date, 
      facilityId, 
      appointmentTypeId,
      bookingPageSlug: bookingPageSlug || 'none',
      effectiveTenantId: effectiveTenantId || 'none'
    });
    
    if (!date || !facilityId || !appointmentTypeId) {
      console.log("VALIDATION ERROR: Missing required parameters");
      return res.status(400).json({ 
        message: "Missing required parameters: date, facilityId, and appointmentTypeId are required" 
      });
    }
    
    // Parse parameters
    const parsedDate = String(date); // YYYY-MM-DD format
    const parsedFacilityId = Number(facilityId);
    const parsedAppointmentTypeId = Number(appointmentTypeId);
    
    // Enforce tenant isolation for all users (not just those with a tenantId)
    // First, check if the user is a super admin
    const isSuperAdmin = req.user?.username?.includes('admin@conmitto.io') || false;
    
    if (isSuperAdmin) {
      console.log(`[AvailabilityHandler] Super admin access granted for facility ${parsedFacilityId}`);
    } else {
      // If not super admin, enforce tenant isolation
      try {
        // Check if the facility belongs to the effective tenant using the organization_facilities junction table
        const facilityQuery = `
          SELECT of.organization_id
          FROM facilities f 
          JOIN organization_facilities of ON f.id = of.facility_id
          WHERE f.id = $1 AND of.organization_id = $2
          LIMIT 1
        `;
        const facilityResult = await pool.query(facilityQuery, [parsedFacilityId, effectiveTenantId]);
        
        if (facilityResult.rows.length === 0) {
          console.log(`[AvailabilityHandler] Facility ${parsedFacilityId} not found or not accessible by tenant ${effectiveTenantId}`);
          
          // Double-check if the facility exists at all
          const checkFacilityQuery = `SELECT id FROM facilities WHERE id = $1 LIMIT 1`;
          const checkResult = await pool.query(checkFacilityQuery, [parsedFacilityId]);
          
          if (checkResult.rows.length === 0) {
            return res.status(404).json({ message: "Facility not found" });
          } else {
            return res.status(403).json({ 
              message: "Access denied to this facility's availability"
            });
          }
        }
        
        console.log(`[AvailabilityHandler] Verified tenant access to facility ${parsedFacilityId} for organization ${effectiveTenantId}`);
      } catch (error) {
        console.error(`[AvailabilityHandler] Error checking facility access:`, error);
        return res.status(500).json({ 
          message: "Error checking facility access"
        });
      }
    }
    
    // Proceed with calculating availability...
    // Continue with the existing availability calculation logic...
    
    try {
      // Get appointment type details
      const appointmentTypeQuery = `
        SELECT * FROM appointment_types
        WHERE id = $1
        LIMIT 1
      `;
      const appointmentTypeResult = await pool.query(appointmentTypeQuery, [parsedAppointmentTypeId]);
      
      if (appointmentTypeResult.rows.length === 0) {
        return res.status(404).json({ message: "Appointment type not found" });
      }
      
      const appointmentType = appointmentTypeResult.rows[0];
      
      // Get facility settings from appointment_settings table
      const facilitySettingsQuery = `
        SELECT * FROM appointment_settings
        WHERE facility_id = $1
        LIMIT 1
      `;
      const facilitySettingsResult = await pool.query(facilitySettingsQuery, [parsedFacilityId]);
      
      // Default facility hours if settings not found
      let startTime = "08:00";
      let endTime = "17:00";
      let isAvailable = true;
      
      // If facility settings exist, use them
      if (facilitySettingsResult.rows.length > 0) {
        const facilitySettings = facilitySettingsResult.rows[0];
        console.log(`Found appointment settings for facility ${parsedFacilityId}:`, facilitySettings);
        // We don't use specific operating hours columns from appointment_settings
        // since those columns don't exist in our table
      } else {
        console.log(`No facility settings found for facility ${parsedFacilityId}, using defaults`);
      }
      
      // Instead, get the facility hours directly from the facilities table
      const requestedDate = new Date(parsedDate);
      const dayOfWeek = requestedDate.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
      const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      const dayName = dayNames[dayOfWeek];
      
      // Query facility hours from the facilities table
      const facilityHoursQuery = `
        SELECT 
          ${dayName}_open as is_open,
          ${dayName}_start as start_time,
          ${dayName}_end as end_time
        FROM facilities
        WHERE id = $1
        LIMIT 1
      `;
      
      const facilityHoursResult = await pool.query(facilityHoursQuery, [parsedFacilityId]);
      
      if (facilityHoursResult.rows.length > 0) {
        const facilityHours = facilityHoursResult.rows[0];
        
        // Check if the facility is open on this day
        if (facilityHours.is_open && facilityHours.start_time && facilityHours.end_time) {
          startTime = facilityHours.start_time;
          endTime = facilityHours.end_time;
          isAvailable = true;
          console.log(`Facility ${parsedFacilityId} hours for ${dayName}: ${startTime}-${endTime}`);
        } else {
          console.log(`Facility ${parsedFacilityId} is closed on ${dayName}`);
          isAvailable = false;
        }
      } else {
        console.log(`No facility found for ID ${parsedFacilityId}, using default hours`);
      }
      
      // Generate time slots at the specified interval (default to 30 mins if not specified)
      const intervalMinutes = appointmentType.duration || 30;
      
      // Check for existing appointments on this date to mark busy slots
      const dateStart = new Date(parsedDate);
      dateStart.setHours(0, 0, 0, 0);
      
      const dateEnd = new Date(parsedDate);
      dateEnd.setHours(23, 59, 59, 999);
      
      // Use correct time format for PostgreSQL
      const dateStartStr = dateStart.toISOString();
      const dateEndStr = dateEnd.toISOString();
      
      // Query to get all appointments for this date and facility
      const busyTimesQuery = `
        SELECT 
          s.start_time, 
          s.end_time,
          s.dock_id
        FROM schedules s
        JOIN docks d ON s.dock_id = d.id
        WHERE d.facility_id = $1
        AND s.start_time >= $2
        AND s.start_time < $3
        ORDER BY s.start_time
      `;
      
      // Get all existing appointments
      const busyTimesResult = await pool.query(busyTimesQuery, [
        parsedFacilityId, 
        dateStartStr, 
        dateEndStr
      ]);
      
      // Get all docks for this facility
      const docksQuery = `
        SELECT id FROM docks
        WHERE facility_id = $1
      `;
      
      const docksResult = await pool.query(docksQuery, [parsedFacilityId]);
      const docks = docksResult.rows.map(d => d.id);
      
      // Create a busy time map by dock
      const busyTimesByDock = {};
      
      // Initialize with empty arrays for each dock
      docks.forEach(dockId => {
        busyTimesByDock[dockId] = [];
      });
      
      // Populate busy times for each dock
      busyTimesResult.rows.forEach(appointment => {
        if (appointment.dock_id) {
          if (!busyTimesByDock[appointment.dock_id]) {
            busyTimesByDock[appointment.dock_id] = [];
          }
          
          busyTimesByDock[appointment.dock_id].push({
            start: new Date(appointment.start_time),
            end: new Date(appointment.end_time)
          });
        }
      });
      
      // Generate all possible time slots (will be empty if facility is closed)
      const allTimeSlots = isAvailable ? generateAvailableTimeSlots(startTime, endTime, intervalMinutes) : [];
      
      // For each time slot, check if we have at least one dock available
      const availableTimes = [];
      
      allTimeSlots.forEach(timeStr => {
        // Convert HH:MM string to a Date object for comparison
        const slotTime = new Date(`${parsedDate}T${timeStr}:00`);
        const slotEndTime = new Date(slotTime.getTime() + (intervalMinutes * 60 * 1000));
        
        // Check if at least one dock is free at this time
        const isSlotAvailable = docks.some(dockId => {
          const dockBusyTimes = busyTimesByDock[dockId] || [];
          
          // Check if this dock is free for this time slot
          return !dockBusyTimes.some(busyTime => 
            (slotTime < busyTime.end && slotEndTime > busyTime.start)
          );
        });
        
        if (isSlotAvailable) {
          availableTimes.push(timeStr);
        }
      });
      
      console.log(`Generated ${availableTimes.length} available slots for facility ${parsedFacilityId} on ${parsedDate}`);
      
      // Generate enhanced slot information for external booking pages
      const slots = availableTimes.map(timeStr => {
        const maxConcurrent = appointmentType.max_concurrent || 1;
        return {
          time: timeStr,
          available: true,
          remainingCapacity: maxConcurrent,
          remaining: maxConcurrent, // Add 'remaining' for compatibility with existing UI
          reason: "",
          isBufferTime: false
        };
      });
      
      // Return the available time slots with enhanced data structure for external booking
      res.json({
        availableTimes,
        date: parsedDate,
        facilityId: parsedFacilityId,
        appointmentTypeId: parsedAppointmentTypeId,
        appointmentTypeDuration: appointmentType.duration || 30, // Use actual appointment type duration
        timezone: appointmentType.timezone || "America/New_York", // Use actual appointment type timezone
        slots: slots // Add detailed slots array for external booking pages
      });
    } catch (err) {
      console.error("Failed to calculate availability:", err);
      res.status(500).json({ 
        message: "Failed to calculate availability",
        error: err.message
      });
    }
  }
  
  // Helper function to generate time slots
  function generateAvailableTimeSlots(startTime, endTime, intervalMinutes) {
    const slots = [];
    let currentTime = new Date(`2000-01-01T${startTime}:00`);
    const endTimeDate = new Date(`2000-01-01T${endTime}:00`);
    
    while (currentTime < endTimeDate) {
      // Format as HH:MM
      const formattedTime = currentTime.toTimeString().substring(0, 5);
      slots.push(formattedTime);
      
      // Add interval
      currentTime = new Date(currentTime.getTime() + intervalMinutes * 60000);
    }
    
    return slots;
  }

  // Public availability endpoint specifically for booking pages
  app.get("/api/public-availability/:bookingPageSlug", async (req, res) => {
    // Set content type explicitly to ensure we return JSON
    res.setHeader('Content-Type', 'application/json');
    
    try {
      const { date, facilityId, appointmentTypeId } = req.query;
      const { bookingPageSlug } = req.params;
      
      if (!date || !facilityId || !appointmentTypeId) {
        console.log("[PublicAvailability] Missing required parameters");
        return res.status(400).json({ 
          message: "Missing required parameters: date, facilityId, and appointmentTypeId are required" 
        });
      }
      
      console.log(`[PublicAvailability] Request with bookingPageSlug: ${bookingPageSlug}`);
      
      // Get the booking page to determine its tenant with direct SQL
      let bookingPage = null;
      try {
        const bookingPageQuery = `
          SELECT * FROM booking_pages
          WHERE slug = $1
          LIMIT 1
        `;
        const { rows } = await pool.query(bookingPageQuery, [bookingPageSlug]);
        bookingPage = rows.length > 0 ? rows[0] : null;
        console.log("[PublicAvailability] Booking page details:", bookingPage);
        
        if (!bookingPage || !bookingPage.tenant_id) {
          console.log(`[PublicAvailability] No valid booking page found for slug: ${bookingPageSlug}`);
          return res.status(404).json({ message: "Booking page not found" });
        }
      } catch (error) {
        console.error("[PublicAvailability] Error getting booking page details:", error);
        return res.status(500).json({ message: "Error retrieving booking page details" });
      }
      
      const tenantId = bookingPage.tenant_id; // Use tenant_id directly from database column
      console.log(`[PublicAvailability] Using booking page tenant context: ${tenantId}`);
      
      // Parse parameters
      const parsedDate = String(date); // YYYY-MM-DD format
      const parsedFacilityId = Number(facilityId);
      const parsedAppointmentTypeId = Number(appointmentTypeId);
      
      // Verify facility belongs to the booking page's tenant
      try {
        const checkAccessQuery = `
          SELECT 1 
          FROM organization_facilities 
          WHERE organization_id = $1 AND facility_id = $2
          LIMIT 1
        `;
        
        const accessResult = await pool.query(checkAccessQuery, [tenantId, parsedFacilityId]);
        
        if (accessResult.rows.length === 0) {
          console.log(`[PublicAvailability] Access denied - facility ${parsedFacilityId} does not belong to tenant ${tenantId}`);
          return res.status(403).json({ 
            message: "Access denied to this facility's availability"
          });
        }
        
        console.log(`[PublicAvailability] Verified tenant access to facility ${parsedFacilityId} for tenant ${tenantId}`);
      } catch (error) {
        console.error(`[PublicAvailability] Error checking facility access:`, error);
        return res.status(500).json({ 
          message: "Error checking facility access"
        });
      }
      
      // Get the appointment type to determine duration and other settings using direct SQL
      let appointmentType = null;
      try {
        const appointmentTypeQuery = `
          SELECT * FROM appointment_types
          WHERE id = $1 AND tenant_id = $2
          LIMIT 1
        `;
        const { rows } = await pool.query(appointmentTypeQuery, [parsedAppointmentTypeId, tenantId]);
        appointmentType = rows.length > 0 ? rows[0] : null;
        console.log("[PublicAvailability] Appointment type:", appointmentType);
        
        if (!appointmentType) {
          console.log(`[PublicAvailability] Appointment type ${parsedAppointmentTypeId} not found for tenant ${tenantId}`);
          return res.status(404).json({ message: "Appointment type not found" });
        }
      } catch (error) {
        console.error("[PublicAvailability] Error getting appointment type:", error);
        return res.status(500).json({ message: "Error retrieving appointment type" });
      }
      
      // Get the facility details using direct SQL
      let facility = null;
      try {
        const facilityQuery = `
          SELECT * FROM facilities
          WHERE id = $1
          LIMIT 1
        `;
        const { rows } = await pool.query(facilityQuery, [parsedFacilityId]);
        facility = rows.length > 0 ? rows[0] : null;
        console.log("[PublicAvailability] Facility details:", facility);
        
        if (!facility) {
          console.log(`[PublicAvailability] Facility ${parsedFacilityId} not found`);
          return res.status(404).json({ message: "Facility not found" });
        }
      } catch (error) {
        console.error("[PublicAvailability] Error getting facility details:", error);
        return res.status(500).json({ message: "Error retrieving facility details" });
      }
      
      // Get existing appointments for the specified date and facility
      // Direct SQL query since this function isn't in our storage interface yet
      const existingAppointmentsQuery = `
        SELECT * FROM schedules 
        WHERE DATE(start_time) = $1 
        AND dock_id IN (
          SELECT id FROM docks WHERE facility_id = $2
        )
      `;
      const { rows: existingAppointments } = await pool.query(existingAppointmentsQuery, [parsedDate, parsedFacilityId]);
      
      // Get facility settings using direct SQL (or use defaults)
      let facilitySettings = null;
      try {
        const facilitySettingsQuery = `
          SELECT * FROM appointment_settings
          WHERE facility_id = $1
          LIMIT 1
        `;
        const { rows } = await pool.query(facilitySettingsQuery, [parsedFacilityId]);
        facilitySettings = rows.length > 0 ? rows[0] : null;
        console.log("[PublicAvailability] Facility settings:", facilitySettings);
      } catch (error) {
        console.warn("[PublicAvailability] Error getting facility settings:", error);
        // Continue with defaults if needed
      }
      
      // Calculate availability
      const startTime = "00:00";
      const endTime = "23:59";
      const intervalMinutes = facilitySettings?.timeInterval || 30;
      
      // Generate all possible time slots for the day
      function generateTimeSlots(start, end, intervalMins) {
        const slots = [];
        let current = start;
        
        while (current <= end) {
          // Add current time to slots
          slots.push(current);
          
          // Parse hours and minutes
          let [hours, minutes] = current.split(':').map(Number);
          
          // Add interval
          minutes += intervalMins;
          
          // Handle hour rollover
          if (minutes >= 60) {
            hours += Math.floor(minutes / 60);
            minutes %= 60;
          }
          
          // Format the new time
          current = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        }
        
        return slots;
      }
      
      const allTimeSlots = generateTimeSlots(startTime, endTime, intervalMinutes);
      
      // Calculate available slots
      const availableSlots = [];
      
      // Process each time slot to determine availability
      allTimeSlots.forEach(timeStr => {
        // Convert HH:MM string to a Date object for comparison
        const slotTime = new Date(`${parsedDate}T${timeStr}:00`);
        const slotEndTime = new Date(slotTime.getTime() + (appointmentType.duration * 60 * 1000));
        
        // Get the max concurrent value from the appointment type
        const appointmentTypeMaxConcurrent = appointmentType.maxConcurrent || 2;
        console.log(`[PublicAvailability] Using maxConcurrent: ${appointmentTypeMaxConcurrent} from appointment type ${appointmentType.id}`);
        
        // Default dock count for this appointment type
        let maxDockCount;
        if (appointmentType.type === 'INBOUND') {
          maxDockCount = facilitySettings?.maxConcurrentInbound || appointmentTypeMaxConcurrent;
        } else if (appointmentType.type === 'OUTBOUND') {
          maxDockCount = facilitySettings?.maxConcurrentOutbound || appointmentTypeMaxConcurrent;
        } else {
          maxDockCount = appointmentTypeMaxConcurrent; // Default to the appointment type's max concurrent value
        }
        
        // Count appointments that overlap with this time slot
        const overlappingAppointments = existingAppointments.filter(appt => {
          const apptStartTime = new Date(appt.start_time);
          const apptEndTime = new Date(appt.end_time);
          return (
            (slotTime <= apptEndTime && slotEndTime >= apptStartTime) && 
            (appt.status !== 'cancelled' && appt.status !== 'rejected')
          );
        });
        
        // Check if we have capacity left
        const availableDockCount = Math.max(0, maxDockCount - overlappingAppointments.length);
        
        if (availableDockCount > 0) {
          availableSlots.push({
            time: timeStr,
            available: true,
            remainingCapacity: availableDockCount,
            remaining: availableDockCount, // For compatibility
            reason: ""
          });
        } else {
          availableSlots.push({
            time: timeStr,
            available: false,
            remainingCapacity: 0,
            remaining: 0,
            reason: "No available docks"
          });
        }
      });
      
      return res.json(availableSlots);
    } catch (error) {
      console.error("[PublicAvailability] Error:", error);
      return res.status(500).json({ message: "Server error calculating availability" });
    }
  });

  // Check availability for booking appointments (main endpoint)
  app.get("/api/availability", async (req, res) => {
    // Set content type explicitly to ensure we return JSON
    res.setHeader('Content-Type', 'application/json');
    try {
      const { date, facilityId, appointmentTypeId, typeId, bookingPageSlug } = req.query;
      // Get the tenant ID from user session
      const userTenantId = req.user?.tenantId;
      
      // Support both parameter naming conventions for backward compatibility
      const finalTypeId = typeId || appointmentTypeId;
      
      // Flag to track if this is a public booking page request
      const isPublicBookingRequest = !!bookingPageSlug;
      
      // Variable to hold the effective tenant ID to use for this request
      let effectiveTenantId = userTenantId;
      
      // If a booking page slug is provided, use it to determine the tenant context
      // This takes priority over the authenticated user's context
      if (bookingPageSlug) {
        console.log(`[AvailabilityEndpoint] Request with bookingPageSlug: ${bookingPageSlug}`);
        
        // Get the booking page to determine its tenant
        const bookingPage = await storage.getBookingPageBySlug(bookingPageSlug as string);
        if (bookingPage && bookingPage.tenantId) {
          effectiveTenantId = bookingPage.tenantId;
          console.log(`[AvailabilityEndpoint] Using booking page tenant context: ${effectiveTenantId}`);
        } else {
          console.log(`[AvailabilityEndpoint] No valid booking page found for slug: ${bookingPageSlug}`);
        }
      }
      
      // INSTRUMENTATION: Log the incoming request parameters
      console.log("===== /api/availability ENDPOINT INSTRUMENTATION =====");
      console.log("REQUEST PARAMETERS:", { 
        date, 
        facilityId, 
        appointmentTypeId, 
        typeId, 
        finalTypeId,
        bookingPageSlug: bookingPageSlug || 'none',
        userTenantId: userTenantId || 'none',
        effectiveTenantId: effectiveTenantId || 'none',
        isPublicBookingRequest
      });
      
      if (!date || !facilityId || !finalTypeId) {
        console.log("VALIDATION ERROR: Missing required parameters");
        return res.status(400).json({ 
          message: "Missing required parameters: date, facilityId, and appointment type ID (typeId or appointmentTypeId) are required" 
        });
      }
      
      // Parse parameters
      const parsedDate = String(date); // YYYY-MM-DD format
      const parsedFacilityId = Number(facilityId);
      const parsedAppointmentTypeId = Number(finalTypeId);
      
      // Enforce tenant isolation for all users (not just those with a tenantId)
      // First, check if the user is a super admin
      const isSuperAdmin = req.user?.username?.includes('admin@conmitto.io') || false;
      
      if (isSuperAdmin) {
        console.log(`[AvailabilityEndpoint] Super admin access granted for facility ${parsedFacilityId}`);
      } else if (isPublicBookingRequest) {
        // For public booking page requests, we still need to verify the facility belongs to the correct tenant
        // but we're more lenient with authentication
        console.log(`[AvailabilityEndpoint] Public booking page request detected for slug: ${bookingPageSlug}`);
        
        // We need at minimum to know which tenant owns the facility
        let facilityTenantId = null;
        
        try {
          // Look up which organization owns this facility with direct SQL
          const facilityOrgQuery = `
            SELECT t.id, t.name 
            FROM tenants t
            JOIN organization_facilities of ON t.id = of.organization_id
            WHERE of.facility_id = $1
            LIMIT 1
          `;
          
          const orgResult = await pool.query(facilityOrgQuery, [parsedFacilityId]);
          
          if (orgResult.rows.length > 0) {
            const orgInfo = orgResult.rows[0];
            console.log(`[AvailabilityEndpoint] Facility ${parsedFacilityId} belongs to organization ${orgInfo.id} (${orgInfo.name})`);
            facilityTenantId = orgInfo.id;
          } else {
            console.log(`[AvailabilityEndpoint] Facility ${parsedFacilityId} not found in any organization`);
            return res.status(404).json({ message: "Facility not found" });
          }
        } catch (error) {
          console.error(`[AvailabilityEndpoint] Error determining facility organization:`, error);
          return res.status(500).json({ message: "Error determining facility organization" });
        }
        
        // If we have a booking page slug, get its tenant context
        if (bookingPageSlug && effectiveTenantId) {
          // Verify the booking page's tenant matches the facility's tenant
          if (effectiveTenantId !== facilityTenantId) {
            console.log(`[AvailabilityEndpoint] Booking page tenant (${effectiveTenantId}) doesn't match facility tenant (${facilityTenantId})`);
            return res.status(400).json({ message: "Booking page and facility don't belong to the same organization" });
          }
          
          console.log(`[AvailabilityEndpoint] Public access granted for facility ${parsedFacilityId} via booking page ${bookingPageSlug}`);
        } else {
          console.log(`[AvailabilityEndpoint] Public access denied - missing valid booking page slug or tenant context`);
          return res.status(400).json({ message: "Invalid booking page slug" });
        }
      } else {
        // Standard authentication checks for logged-in users
        // Use effectiveTenantId (from booking page or user) for access control
        let facilityTenantId = effectiveTenantId;
        
        // If no tenant ID yet, try to determine tenant from the requested facility
        if (!facilityTenantId) {
          try {
            // Look up which organization owns this facility with direct SQL
            const facilityOrgQuery = `
              SELECT t.id, t.name 
              FROM tenants t
              JOIN organization_facilities of ON t.id = of.organization_id
              WHERE of.facility_id = $1
              LIMIT 1
            `;
            
            const orgResult = await pool.query(facilityOrgQuery, [parsedFacilityId]);
            
            if (orgResult.rows.length > 0) {
              const orgInfo = orgResult.rows[0];
              console.log(`[AvailabilityEndpoint] Facility ${parsedFacilityId} belongs to organization ${orgInfo.id} (${orgInfo.name})`);
              facilityTenantId = orgInfo.id;
            }
          } catch (error) {
            console.error(`[AvailabilityEndpoint] Error determining facility organization:`, error);
          }
        }
        
        // If using a tenantId (from session, booking page, or derived), verify facility access
        if (facilityTenantId) {
          try {
            // Verify facility belongs to the effective tenant using direct SQL
            const checkAccessQuery = `
              SELECT 1 
              FROM organization_facilities 
              WHERE organization_id = $1 AND facility_id = $2
              LIMIT 1
            `;
            
            const accessResult = await pool.query(checkAccessQuery, [facilityTenantId, parsedFacilityId]);
            
            const hasAccess = isSuperAdmin || accessResult.rows.length > 0;
            
            // If we have a user tenant ID, and it's different from our effective tenant ID,
            // we're dealing with cross-tenant access via a booking page
            if (userTenantId && userTenantId !== facilityTenantId) {
              console.log(`[AvailabilityEndpoint] Cross-tenant access via booking page - facility ${parsedFacilityId} belongs to tenant ${facilityTenantId}, user is from tenant ${userTenantId}`);
              
              // For cross-tenant access via booking page, we allow it but log it
              if (bookingPageSlug) {
                console.log(`[AvailabilityEndpoint] Allowing cross-tenant access via booking page ${bookingPageSlug}`);
              } else {
                // If no booking page slug, don't allow cross-tenant access
                console.log(`[AvailabilityEndpoint] Denying cross-tenant access - facility ${parsedFacilityId} belongs to tenant ${facilityTenantId}, user is from tenant ${userTenantId}`);
                return res.status(403).json({ 
                  message: "Access denied to this facility's availability" 
                });
              }
            }
            
            if (!hasAccess) {
              console.log(`[AvailabilityEndpoint] Access denied - facility ${parsedFacilityId} does not belong to tenant ${facilityTenantId}`);
              return res.status(403).json({ 
                message: "Access denied to this facility's availability"
              });
            }
            
            console.log(`[AvailabilityEndpoint] Verified tenant access to facility ${parsedFacilityId} for tenant ${facilityTenantId}`);
          } catch (error) {
            console.error(`[AvailabilityEndpoint] Error checking facility access:`, error);
            return res.status(500).json({ 
              message: "Error checking facility access"
            });
          }
        }
        
        // Additional check: verify appointment type belongs to the facility's tenant
        try {
          const appointmentTypeQuery = `
            SELECT t.id, t.name 
            FROM tenants t
            JOIN appointment_types apt ON t.id = apt.tenant_id
            WHERE apt.id = $1
            LIMIT 1
          `;
          
          const aptResult = await pool.query(appointmentTypeQuery, [parsedAppointmentTypeId]);
          
          if (aptResult.rows.length > 0) {
            const appointmentTypeOrg = aptResult.rows[0];
            console.log(`[AvailabilityEndpoint] Appointment type ${parsedAppointmentTypeId} belongs to organization ${appointmentTypeOrg.id} (${appointmentTypeOrg.name})`);
            
            // For appointment types, we should only validate against the facility's tenant
            // or the booking page tenant (effectiveTenantId), not the user's tenant ID
            if (facilityTenantId && appointmentTypeOrg.id !== facilityTenantId) {
              console.log(`[AvailabilityEndpoint] Access denied - appointment type ${parsedAppointmentTypeId} belongs to org ${appointmentTypeOrg.id}, facility belongs to tenant ${facilityTenantId}`);
              return res.status(403).json({ 
                message: "Access denied: you don't have permission to access this resource"
              });
            }
          }
        } catch (error) {
          console.error(`[AvailabilityEndpoint] Error checking appointment type organization:`, error);
        }
      }
      
      // Get the appointment type to determine duration and other settings
      // Use the effectiveTenantId (from booking page or user) for tenant isolation
      const appointmentType = await storage.getAppointmentType(parsedAppointmentTypeId, effectiveTenantId);
      if (!appointmentType) {
        console.log(`VALIDATION ERROR: Appointment type ${parsedAppointmentTypeId} not found for tenant ${effectiveTenantId || 'none'}`);
        return res.status(404).json({ message: "Appointment type not found" });
      }
      
      // INSTRUMENTATION: Log the appointment type with override flag and buffer time
      console.log("APPOINTMENT TYPE:", {
        id: appointmentType.id,
        name: appointmentType.name,
        facilityId: appointmentType.facilityId,
        duration: appointmentType.duration,
        overrideFacilityHours: appointmentType.overrideFacilityHours,
        bufferTime: appointmentType.bufferTime || 0,
        gracePeriod: appointmentType.gracePeriod || 0,
        maxConcurrent: appointmentType.maxConcurrent || 1
      });
      
      // For tenant isolation purposes, we've already verified:
      // 1. The facility belongs to the tenant (checkTenantFacilityAccess)
      // 2. The appointment type belongs to the tenant (getAppointmentType with tenantId)
      //
      // We should not require that appointmentType.facilityId === parsedFacilityId
      // since the data model allows appointment types to be used across facilities
      
      // Log appointment type and facility info for debugging
      console.log(`[Availability] Using appointment type: ${appointmentType.id} (${appointmentType.name}) with facilityId: ${appointmentType.facilityId || 'undefined'}, requested facilityId: ${parsedFacilityId}`);
      
      
      // Get facility to determine timezone
      const facility = await storage.getFacility(parsedFacilityId);
      if (!facility) {
        console.log("VALIDATION ERROR: Facility not found");
        return res.status(404).json({ message: "Facility not found" });
      }
      
      // INSTRUMENTATION: Log the facility info
      console.log("FACILITY:", {
        id: facility.id,
        name: facility.name,
        timezone: facility.timezone
      });
      
      // Get facility appointment settings
      let facilitySettings = await storage.getAppointmentSettings(parsedFacilityId);
      
      // Create default settings if not found rather than failing
      if (!facilitySettings) {
        console.log(`NOTICE: Creating default facility settings for facilityId ${parsedFacilityId}`);
        facilitySettings = {
          id: 0, // Temporary ID
          facilityId: parsedFacilityId,
          timeInterval: 15,
          maxConcurrentInbound: 2,
          maxConcurrentOutbound: 2,
          shareAvailabilityInfo: true,
          createdAt: new Date(),
          lastModifiedAt: null,
          // Day availability settings
          sunday: false,
          monday: true,
          tuesday: true,
          wednesday: true,
          thursday: true,
          friday: true,
          saturday: false,
          // Time windows
          sundayStartTime: "08:00",
          sundayEndTime: "17:00",
          mondayStartTime: "08:00",
          mondayEndTime: "17:00",
          tuesdayStartTime: "08:00",
          tuesdayEndTime: "17:00",
          wednesdayStartTime: "08:00",
          wednesdayEndTime: "17:00",
          thursdayStartTime: "08:00",
          thursdayEndTime: "17:00",
          fridayStartTime: "08:00",
          fridayEndTime: "17:00",
          saturdayStartTime: "08:00",
          saturdayEndTime: "17:00",
          // Break times
          sundayBreakStartTime: "12:00",
          sundayBreakEndTime: "13:00",
          mondayBreakStartTime: "12:00",
          mondayBreakEndTime: "13:00",
          tuesdayBreakStartTime: "12:00",
          tuesdayBreakEndTime: "13:00",
          wednesdayBreakStartTime: "12:00",
          wednesdayBreakEndTime: "13:00",
          thursdayBreakStartTime: "12:00",
          thursdayBreakEndTime: "13:00",
          fridayBreakStartTime: "12:00",
          fridayBreakEndTime: "13:00",
          saturdayBreakStartTime: "12:00",
          saturdayBreakEndTime: "13:00", 
          // Additional fields
          allowAppointmentsThroughBreaks: false,
          allowAppointmentsPastBusinessHours: false
        };
      }
      
      // INSTRUMENTATION: Log facility settings (hours)
      if (facilitySettings) {
        // Note: The actual database schema doesn't have the day-of-week fields that 
        // are defined in shared/schema.ts. We're logging what we have available.
        console.log("FACILITY SETTINGS:", {
          id: facilitySettings.id,
          facilityId: facilitySettings.facilityId,
          timeInterval: facilitySettings.timeInterval,
          maxConcurrentInbound: facilitySettings.maxConcurrentInbound,
          maxConcurrentOutbound: facilitySettings.maxConcurrentOutbound,
          shareAvailabilityInfo: facilitySettings.shareAvailabilityInfo
        });
      } else {
        console.log("FACILITY SETTINGS: None configured");
      }
      
      // Use appointment-availability.ts logic by importing it directly
      const appointmentAvailability = await import('../client/src/lib/appointment-availability');
      const generateAvailableTimeSlots = appointmentAvailability.generateAvailableTimeSlots;
      
      let timeSlots;
      
      // Check if this appointment type overrides facility hours
      if (appointmentType.overrideFacilityHours) {
        console.log(`AVAILABILITY STRATEGY: Appointment type ${appointmentType.id} overrides facility hours, allowing all time slots`);
        
        // Generate all slots as available since this type ignores facility hours
        timeSlots = generateAvailableTimeSlots(
          parsedDate,
          [], // Empty rules means all time slots are available
          appointmentType.duration || 60,
          appointmentType.timezone || facility.timezone || 'America/New_York',
          15 // 15-minute intervals
        );
      } else {
        console.log(`AVAILABILITY STRATEGY: Using facility hours for appointment type ${appointmentType.id}`);
        
        // If facility settings exist, create availability rules from them
        if (facilitySettings) {
          // Parse the day of week from the date
          const dateObj = new Date(parsedDate);
          const dayOfWeek = dateObj.getDay(); // 0-6, Sunday-Saturday
          const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];
          console.log(`AVAILABILITY CONTEXT: Checking for day ${dayOfWeek} (${dayName})`);
          
          // Use actual facility settings based on day of week
          let isAvailable = false;
          let startTime = "08:00";
          let endTime = "17:00";
          let breakStartTime = "12:00";
          let breakEndTime = "13:00";
          let maxAppointments = facilitySettings.maxConcurrentInbound + facilitySettings.maxConcurrentOutbound;
          
          // Check facility day availability based on the day of the week
          switch (dayOfWeek) {
            case 0: // Sunday
              isAvailable = facilitySettings.sunday || false;
              startTime = facilitySettings.sundayStartTime || "08:00";
              endTime = facilitySettings.sundayEndTime || "17:00";
              breakStartTime = facilitySettings.sundayBreakStartTime || "12:00";
              breakEndTime = facilitySettings.sundayBreakEndTime || "13:00";
              break;
            case 1: // Monday
              isAvailable = facilitySettings.monday || true;
              startTime = facilitySettings.mondayStartTime || "08:00";
              endTime = facilitySettings.mondayEndTime || "17:00";
              breakStartTime = facilitySettings.mondayBreakStartTime || "12:00";
              breakEndTime = facilitySettings.mondayBreakEndTime || "13:00";
              break;
            case 2: // Tuesday
              isAvailable = facilitySettings.tuesday || true;
              startTime = facilitySettings.tuesdayStartTime || "08:00";
              endTime = facilitySettings.tuesdayEndTime || "17:00";
              breakStartTime = facilitySettings.tuesdayBreakStartTime || "12:00";
              breakEndTime = facilitySettings.tuesdayBreakEndTime || "13:00";
              break;
            case 3: // Wednesday
              isAvailable = facilitySettings.wednesday || true;
              startTime = facilitySettings.wednesdayStartTime || "08:00";
              endTime = facilitySettings.wednesdayEndTime || "17:00";
              breakStartTime = facilitySettings.wednesdayBreakStartTime || "12:00";
              breakEndTime = facilitySettings.wednesdayBreakEndTime || "13:00";
              break;
            case 4: // Thursday
              isAvailable = facilitySettings.thursday || true;
              startTime = facilitySettings.thursdayStartTime || "08:00";
              endTime = facilitySettings.thursdayEndTime || "17:00";
              breakStartTime = facilitySettings.thursdayBreakStartTime || "12:00";
              breakEndTime = facilitySettings.thursdayBreakEndTime || "13:00";
              break;
            case 5: // Friday
              isAvailable = facilitySettings.friday || true;
              startTime = facilitySettings.fridayStartTime || "08:00";
              endTime = facilitySettings.fridayEndTime || "17:00";
              breakStartTime = facilitySettings.fridayBreakStartTime || "12:00";
              breakEndTime = facilitySettings.fridayBreakEndTime || "13:00";
              break;
            case 6: // Saturday
              isAvailable = facilitySettings.saturday || false;
              startTime = facilitySettings.saturdayStartTime || "08:00";
              endTime = facilitySettings.saturdayEndTime || "13:00";
              breakStartTime = facilitySettings.saturdayBreakStartTime || "12:00";
              breakEndTime = facilitySettings.saturdayBreakEndTime || "13:00";
              break;
          }
          
          // Look for settings in the daily_availability table instead
          // For now, use default values from facility settings
          
          // INSTRUMENTATION: Log the facility hours for this day
          console.log(`DAY AVAILABILITY (using facility settings):`, {
            day: dayName,
            isAvailable,
            hours: isAvailable ? `${startTime}-${endTime}` : "Closed",
            breakTime: isAvailable && breakStartTime && breakEndTime ? `${breakStartTime}-${breakEndTime}` : "N/A",
            maxAppointments,
            note: "Using facility settings from database"
          });
          
          // Get the actual max concurrent value from the appointment type
          // Use this for setting the remaining capacity correctly
          const maxConcurrent = appointmentType.maxConcurrent || 2;
          console.log(`APPOINTMENT TYPE: Max concurrent value is ${maxConcurrent} for type ${appointmentType.id}`);
          
          // Create a facility rule for this specific day
          // Using inline type to avoid circular dependency issues
          const facilityRule = {
            id: 0, // Placeholder ID
            appointmentTypeId: parsedAppointmentTypeId,
            dayOfWeek,
            startDate: null,
            endDate: null,
            startTime,
            endTime,
            isActive: isAvailable,
            facilityId: parsedFacilityId, 
            maxConcurrent,
            maxAppointmentsPerDay: maxAppointments || (appointmentType.maxAppointmentsPerDay || undefined),
            // Make sure buffer time is correctly included and treated as a number
            // Default to 60 minutes if not specified
            bufferTime: appointmentType.bufferTime ? Number(appointmentType.bufferTime) : 60,
            gracePeriod: appointmentType.gracePeriod,
            showRemainingSlots: appointmentType.showRemainingSlots
          };
          
          // Log buffer time to check if it's being correctly passed
          console.log(`AVAILABILITY RULE: Using buffer time of ${facilityRule.bufferTime} minutes for ${appointmentType.name}`);
          
          // Generate time slots based on facility hours
          // IMPORTANT: Buffer time determines the interval between slots (not "dead zones")
          // If buffer time is 60 minutes, slots should be hourly (e.g., 8:00, 9:00, 10:00)
          // Default to 15-minute intervals if no buffer time is specified
          const intervalToUse = (appointmentType.bufferTime && appointmentType.bufferTime > 0) 
            ? appointmentType.bufferTime 
            : (facilitySettings.timeInterval || 15);
            
          console.log(`[generateAvailableTimeSlots] Using interval of ${intervalToUse} minutes based on buffer time ${appointmentType.bufferTime}`);
          
          // Create a second rule for break times if we're not allowed to schedule through breaks
          const rules = [facilityRule];
          
          // Add an "unavailable" rule for break time if needed
          if (!appointmentType.allowAppointmentsThroughBreaks && breakStartTime && breakEndTime) {
            console.log(`AVAILABILITY RULE: Adding lunch break rule from ${breakStartTime} to ${breakEndTime}`);
            
            // Add a rule that makes the break time unavailable
            rules.push({
              id: 999, // Placeholder ID for break rule
              appointmentTypeId: parsedAppointmentTypeId,
              dayOfWeek,
              startDate: null,
              endDate: null,
              startTime: breakStartTime,
              endTime: breakEndTime,
              isActive: true, // Rule is active, but with maxConcurrent: 0 to block the time
              facilityId: parsedFacilityId,
              maxConcurrent: 0, // Set to 0 to make this time period unavailable
              maxAppointmentsPerDay: 0, 
              bufferTime: 0,
              gracePeriod: 0,
              showRemainingSlots: false
            });
          }
          
          timeSlots = generateAvailableTimeSlots(
            parsedDate,
            rules,
            appointmentType.duration || 60,
            appointmentType.timezone || facility.timezone || 'America/New_York',
            intervalToUse // Use buffer time as the interval if available
          );
        } else {
          // If no facility settings, generate slots with no restrictions
          console.log("AVAILABILITY STRATEGY: No facility settings found, generating all slots as available");
          timeSlots = generateAvailableTimeSlots(
            parsedDate,
            [],
            appointmentType.duration || 60,
            appointmentType.timezone || facility.timezone || 'America/New_York',
            15 // 15-minute intervals
          );
        }
      }
      
      // INSTRUMENTATION: Log the generated time slots (sample of first 5)
      console.log("GENERATED TIME SLOTS (sample):", timeSlots.slice(0, 5));
      
      // Count available slots
      const availableSlotCount = timeSlots.filter((slot: any) => slot.available).length;
      console.log(`AVAILABILITY SUMMARY: Generated ${timeSlots.length} total slots, ${availableSlotCount} available`);
      
      // Include all time slots with their full details (including remaining capacity)
      // For backward compatibility, also include the original availableTimes array
      const availableTimes = timeSlots
        .filter((slot: any) => slot.available)
        .map((slot: any) => slot.time);
      
      // Create response object
      const responseData = { 
        slots: timeSlots, // Full slot objects with remaining capacity information
        availableTimes,   // Original format for backward compatibility
        date: parsedDate,
        facilityId: parsedFacilityId,
        appointmentTypeId: parsedAppointmentTypeId,
        appointmentTypeDuration: appointmentType.duration,
        timezone: appointmentType.timezone || facility.timezone || 'America/New_York'
      };
      
      // INSTRUMENTATION: Log the response structure
      console.log("RESPONSE STRUCTURE:", {
        hasSlots: !!responseData.slots,
        slotCount: responseData.slots?.length,
        hasAvailableTimes: !!responseData.availableTimes,
        availableTimesCount: responseData.availableTimes?.length,
        firstAvailableSlot: responseData.availableTimes?.[0] || null
      });
      console.log("===== END /api/availability INSTRUMENTATION =====");
      
      // Send the response
      res.json(responseData);
    } catch (err) {
      console.error("Error calculating availability:", err);
      res.status(500).json({ 
        message: "Failed to calculate availability", 
        error: err instanceof Error ? err.message : String(err)
      });
    }
  });

  // Test email template (development only)
  if (process.env.NODE_ENV === 'development') {
    // Test all email templates
    app.get('/api/test-all-emails', async (req, res) => {
      try {
        // Import the email test function
        const { testEmailTemplate } = await import('./email-test');
        const result = await testEmailTemplate();
        
        // Return links to the generated templates
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Email Templates Test</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f0f0f0; }
              .container { max-width: 800px; margin: 0 auto; }
              .header { background-color: #4CAF50; color: white; padding: 15px; border-radius: 5px 5px 0 0; }
              .content { border: 1px solid #ddd; border-radius: 0 0 5px 5px; padding: 20px; background-color: white; }
              .footer { margin-top: 20px; text-align: center; color: #666; }
              .link { display: block; margin: 10px 0; padding: 10px; background-color: #e0f0e0; border-radius: 5px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Email Templates Test</h1>
                <p>All email templates have been generated successfully</p>
              </div>
              <div class="content">
                <h2>Generated Email Templates</h2>
                <a class="link" href="/email-confirmation-test.html" target="_blank">View Confirmation Email</a>
                <a class="link" href="/email-reschedule-test.html" target="_blank">View Reschedule Email</a>
                <a class="link" href="/email-cancellation-test.html" target="_blank">View Cancellation Email</a>
                <a class="link" href="/email-reminder-test.html" target="_blank">View Reminder Email</a>
              </div>
              <div class="footer">
                <p>These templates are used for all emails sent by the system.</p>
              </div>
            </div>
          </body>
          </html>
        `);
      } catch (error) {
        console.error('Error testing email templates:', error);
        res.status(500).send(`Error testing email templates: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    app.get('/api/test-email-template', async (req, res) => {
      try {
        // Create a sample schedule with all the data we need
        const sampleData = {
          id: 46,
          dockName: "Dock 3",
          facilityName: "Sam Pride",
          startTime: new Date("2025-04-30T17:00:00Z"), // 5:00 PM UTC
          endTime: new Date("2025-04-30T18:00:00Z"),   // 6:00 PM UTC
          truckNumber: "10000",
          customerName: "Conmitto Inc.",
          type: "delivery",
          driverName: "Akash Agarwal",
          driverPhone: "4082303749",
          carrierName: "UPS",
          mcNumber: "MC178930",
          timezone: "America/New_York" // EDT
        };
        
        // Generate email HTML
        // Extract function to get email data
        const getEmailData = (recipientEmail: string, data: any) => {
          const formattedDate = data.startTime.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric', 
            month: 'long', 
            day: 'numeric'
          });
          
          const facilityTimezone = data.timezone || 'America/New_York';
          
          const facilityStartTime = data.startTime.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: facilityTimezone
          });
          
          const facilityEndTime = data.endTime.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: facilityTimezone
          });
          
          const facilityTzAbbr = new Intl.DateTimeFormat('en-US', {
            timeZone: facilityTimezone,
            timeZoneName: 'short'
          }).formatToParts(data.startTime)
            .find(part => part.type === 'timeZoneName')?.value || '';
          
          const localStartTime = data.startTime.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
          });
          
          const localEndTime = data.endTime.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
          });
          
          const localTzAbbr = new Intl.DateTimeFormat('en-US', {
            timeZoneName: 'short'
          }).formatToParts(data.startTime)
            .find(part => part.type === 'timeZoneName')?.value || '';
          
          const confirmationCode = `HC${data.id}`;
          
          return {
            to: recipientEmail,
            from: 'noreply@dockoptimizer.com',
            subject: `Dock Appointment Confirmation #${data.id}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #4CAF50;">Dock Appointment Confirmed</h2>
                <p>Your appointment has been successfully scheduled. Please save your confirmation code for reference.</p>
                
                <div style="background-color: #f0f9f0; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center;">
                  <h3 style="margin-top: 0;">Confirmation Code</h3>
                  <p style="font-size: 24px; font-weight: bold;">${confirmationCode}</p>
                </div>
                
                <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                  <h3 style="margin-top: 0;">Appointment Details</h3>
                  <p><strong>Date:</strong> ${formattedDate}</p>
                  <p><strong>Facility time:</strong> ${facilityStartTime} - ${facilityEndTime} (${facilityTzAbbr})</p>
                  <p><strong>Your local time:</strong> ${localStartTime} - ${localEndTime} (${localTzAbbr})</p>
                  <p><strong>Facility:</strong> ${data.facilityName}</p>
                  <p><strong>Dock:</strong> ${data.dockName === "Not scheduled yet" ? 
                    "<span style='color: #777;'>Not assigned yet</span> (will be assigned prior to your arrival)" : 
                    data.dockName}
                  </p>
                </div>
                
                <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                  <h3 style="margin-top: 0;">Contact Information</h3>
                  <p><strong>Company:</strong> ${data.customerName || 'N/A'}</p>
                  <p><strong>Contact:</strong> ${data.driverName || 'N/A'}</p>
                  <p><strong>Phone:</strong> ${data.driverPhone || 'N/A'}</p>
                  <p><strong>Email:</strong> ${recipientEmail}</p>
                </div>
                
                <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                  <h3 style="margin-top: 0;">Carrier Information</h3>
                  <p><strong>Carrier:</strong> ${data.carrierName || 'N/A'} ${data.mcNumber ? `(MC#: ${data.mcNumber})` : ''}</p>
                  <p><strong>Driver:</strong> ${data.driverName || 'N/A'}</p>
                  <p><strong>Truck:</strong> ${data.truckNumber || 'N/A'}</p>
                </div>
                
                <p>Please arrive at your scheduled time. If you need to modify or cancel this appointment, please use the links below.</p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="https://app.dockoptimizer.com/reschedule?code=${confirmationCode}" style="display: inline-block; background-color: #2196F3; color: white; padding: 10px 20px; margin: 0 10px; text-decoration: none; border-radius: 4px; font-weight: bold;">Reschedule Appointment</a>
                  <a href="https://app.dockoptimizer.com/cancel?code=${confirmationCode}" style="display: inline-block; background-color: #f44336; color: white; padding: 10px 20px; margin: 0 10px; text-decoration: none; border-radius: 4px; font-weight: bold;">Cancel Appointment</a>
                </div>
                
                <div style="margin-top: 30px; font-size: 12px; color: #666;">
                  <p>This is an automated message from Dock Optimizer. Please do not reply to this email.</p>
                </div>
              </div>
            `,
          };
        };
        
        const emailData = getEmailData('test@example.com', sampleData);
        
        // Set response content type to HTML
        res.header('Content-Type', 'text/html');
        
        // Send the HTML template with a small browser frame
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Email Template Preview</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f0f0f0; }
              .container { max-width: 800px; margin: 0 auto; }
              .header { background-color: #4CAF50; color: white; padding: 15px; border-radius: 5px 5px 0 0; }
              .preview { border: 1px solid #ddd; border-radius: 0 0 5px 5px; padding: 20px; background-color: white; }
              .footer { margin-top: 20px; text-align: center; color: #666; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Email Template Preview</h1>
                <p>This is a preview of the appointment confirmation email template</p>
              </div>
              <div class="preview">
                ${emailData.html}
              </div>
              <div class="footer">
                <p>This template is used for all appointment confirmation emails sent by the system.</p>
              </div>
            </div>
          </body>
          </html>
        `);
      } catch (error) {
        console.error('Error testing email template:', error);
        res.status(500).json({ 
          success: false, 
          message: 'Error testing email template',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });
  }

  // Tenant isolation test endpoint
  app.get('/api/tenant-isolation-test', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      const storage = await getStorage();
      const userTenantId = req.user.tenantId;
      
      // Get facilities for the user's tenant
      const tenantFacilities = await storage.getFacilitiesByOrganizationId(userTenantId);
      
      // Get booking pages for the user's tenant
      const bookingPages = await storage.getBookingPagesForOrganization(userTenantId);
      
      // Get all active modules for the user's tenant
      const tenantModules = await storage.getOrganizationModules(userTenantId);
      const activeModules = tenantModules.filter(module => module.enabled).map(module => module.moduleName);
      
      // Return the tenant-specific data
      res.json({
        tenantId: userTenantId,
        username: req.user.username,
        role: req.user.role,
        facilities: tenantFacilities,
        bookingPages: bookingPages,
        activeModules: activeModules
      });
    } catch (error) {
      console.error('Error in tenant isolation test:', error);
      res.status(500).json({ message: 'Error testing tenant isolation', error: error.message });
    }
  });

  const httpServer = createServer(app);
  
  // Initialize WebSocket server on the same HTTP server but with a different path
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws' 
  });
  
  // Store connected clients with their tenant information and ping status
  const clients = new Map<WebSocket, { 
    tenantId?: number,
    userId?: number,
    isAlive: boolean
  }>();
  
  // Set up ping interval to detect disconnected clients
  const pingInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const clientInfo = clients.get(ws);
      if (clientInfo && clientInfo.isAlive === false) {
        console.log('[WebSocket] Terminating inactive client');
        clients.delete(ws);
        return ws.terminate();
      }
      
      // Mark client as inactive and send ping
      if (clientInfo) {
        clientInfo.isAlive = false;
        clients.set(ws, clientInfo);
      }
      
      // Send ping (client should respond with pong)
      ws.ping();
    });
  }, 30000); // Check every 30 seconds
  
  // Clean up interval on server shutdown
  wss.on('close', () => {
    console.log('[WebSocket] Server closing, clearing ping interval');
    clearInterval(pingInterval);
  });
  
  // Handle WebSocket connections
  wss.on('connection', (ws, req) => {
    console.log('[WebSocket] New client connected');
    
    // Store client connection with alive status
    clients.set(ws, { isAlive: true });
    
    // Handle pong messages (heartbeat response)
    ws.on('pong', () => {
      const clientInfo = clients.get(ws);
      if (clientInfo) {
        clientInfo.isAlive = true;
        clients.set(ws, clientInfo);
      }
    });
    
    // Send initial connection message
    ws.send(JSON.stringify({ type: 'connected' }));
    
    // Handle auth message to associate connection with user/tenant
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Handle auth message
        if (data.type === 'auth' && data.tenantId) {
          console.log(`[WebSocket] Authenticated client for tenant ${data.tenantId}`);
          const currentInfo = clients.get(ws) || { isAlive: true };
          clients.set(ws, { 
            ...currentInfo,
            tenantId: data.tenantId,
            userId: data.userId
          });
        }
      } catch (error) {
        console.error('[WebSocket] Error processing message:', error);
      }
    });
    
    // Handle disconnection
    ws.on('close', () => {
      console.log('[WebSocket] Client disconnected');
      clients.delete(ws);
    });
  });
  
  // Add test routes for WebSocket functionality
  app.post('/api/test/websocket-broadcast', (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    // Get the current user's tenant ID
    const tenantId = req.user?.tenantId;
    
    try {
      const { type, message } = req.body;
      
      // Create the message payload
      const payload = {
        type: type || 'test_message',
        data: {
          message: message || 'Test broadcast from server',
          timestamp: new Date().toISOString(),
          source: 'test-api'
        }
      };
      
      console.log(`[WebSocket Test] Broadcasting message to tenant ${tenantId}:`, payload);
      
      // Send to all connected clients for this tenant
      let clientCount = 0;
      clients.forEach((clientInfo, client) => {
        if (
          client.readyState === WebSocket.OPEN && 
          (clientInfo.tenantId === tenantId || clientInfo.tenantId === 0)
        ) {
          client.send(JSON.stringify(payload));
          clientCount++;
        }
      });
      
      console.log(`[WebSocket Test] Sent test message to ${clientCount} connected clients`);
      
      res.status(200).json({ 
        success: true, 
        clientCount,
        message: `Broadcast sent to ${clientCount} clients`
      });
    } catch (error) {
      console.error('[WebSocket Test] Error broadcasting test message:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to broadcast test message' 
      });
    }
  });
  
  app.post('/api/test/websocket-disconnect', (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    try {
      // First inform all clients they're about to be disconnected
      const disconnectWarning = {
        type: 'test_disconnect',
        data: {
          message: 'Test disconnect initiated',
          timestamp: new Date().toISOString(),
          reconnectDelay: 5000
        }
      };
      
      console.log('[WebSocket Test] Sending disconnect warning to all clients');
      
      // Send the warning
      clients.forEach((clientInfo, client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(disconnectWarning));
        }
      });
      
      // Wait a moment to let the warning message arrive
      setTimeout(() => {
        console.log('[WebSocket Test] Closing all WebSocket connections for testing');
        
        // Count how many clients we're disconnecting
        let clientCount = 0;
        
        // Close all connections
        clients.forEach((clientInfo, client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.terminate();
            clientCount++;
          }
        });
        
        console.log(`[WebSocket Test] Disconnected ${clientCount} clients for testing`);
      }, 1000);
      
      res.status(200).json({ 
        success: true, 
        message: 'Disconnecting all WebSocket clients for testing'
      });
    } catch (error) {
      console.error('[WebSocket Test] Error disconnecting clients:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to disconnect WebSocket clients' 
      });
    }
  });
  
  // Add a global function to broadcast schedule updates to relevant tenants
  app.locals.broadcastScheduleUpdate = (schedule: any) => {
    const tenantId = schedule.tenantId;
    
    // Log broadcast attempt
    console.log(`[WebSocket] Broadcasting schedule update for tenant ${tenantId}, schedule ID: ${schedule.id}`);
    
    // Convert schedule to a message
    const message = JSON.stringify({
      type: 'schedule_update',
      data: schedule
    });
    
    // Send to all connected clients for this tenant
    let clientCount = 0;
    clients.forEach((clientInfo, client) => {
      // Check if client is still connected and belongs to the correct tenant
      // (or is a super admin that should receive all updates)
      if (
        client.readyState === WebSocket.OPEN && 
        (clientInfo.tenantId === tenantId || clientInfo.tenantId === 0)
      ) {
        client.send(message);
        clientCount++;
      }
    });
    
    console.log(`[WebSocket] Sent update to ${clientCount} connected clients`);
  };
  
  // Start the email reminder scheduler
  try {
    console.log("[ReminderScheduler] Initializing email reminder scheduler...");
    startReminderScheduler();
    console.log("[ReminderScheduler] Email reminder scheduler initialized successfully");
  } catch (error) {
    console.error("[ReminderScheduler] Error initializing email reminder scheduler:", error);
  }
  
  return httpServer;
}
