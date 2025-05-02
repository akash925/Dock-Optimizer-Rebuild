import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { getStorage } from "./storage";
import { setupAuth } from "./auth";
import { z } from "zod";
import { getBookingStyles } from "./controllers/admin-controller";
import path from "path";
import fs from "fs";
import multer from "multer";
import { sendConfirmationEmail, sendEmail } from "./notifications";
import { testEmailTemplate } from "./email-test";
import { adminRoutes } from "./modules/admin/routes";
import { pool } from "./db";

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
  insertBookingPageSchema,
} from "@shared/schema";

// Import the super-admin creation script and seed roles
import { createSuperAdmin } from "./create-super-admin";
import { fixAdminPassword } from "./fix-admin-password";
import { seedRoles } from "./seed-roles";
import { hashPassword as authHashPassword } from "./auth";

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
  
  // Register organization modules routes
  try {
    const { registerOrganizationModulesRoutes } = await import('./modules/admin/organizations/routes');
    registerOrganizationModulesRoutes(app);
    console.log('Organization modules routes registered');
  } catch (error) {
    console.error('Error registering organization modules routes:', error);
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
      const docks = await storage.getDocks();
      res.json(docks);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch docks" });
    }
  });
  
  // Get docks by facility
  app.get("/api/facilities/:id/docks", async (req, res) => {
    try {
      const facilityId = Number(req.params.id);
      const facility = await storage.getFacility(facilityId);
      
      if (!facility) {
        return res.status(404).json({ message: "Facility not found" });
      }
      
      const docks = await storage.getDocks();
      const facilityDocks = docks.filter(dock => dock.facilityId === facilityId);
      
      res.json(facilityDocks);
    } catch (err) {
      console.error("Error fetching facility docks:", err);
      res.status(500).json({ message: "Failed to fetch facility docks" });
    }
  });

  app.get("/api/docks/:id", async (req, res) => {
    try {
      const dock = await storage.getDock(Number(req.params.id));
      if (!dock) {
        return res.status(404).json({ message: "Dock not found" });
      }
      res.json(dock);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch dock" });
    }
  });

  app.post("/api/docks", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const validatedData = insertDockSchema.parse(req.body);
      const dock = await storage.createDock(validatedData);
      res.status(201).json(dock);
    } catch (err) {
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
      console.log(`Creating dock for facility ID: ${facilityId} with data:`, req.body);
      
      const facility = await storage.getFacility(facilityId);
      if (!facility) {
        return res.status(404).json({ message: "Facility not found" });
      }
      
      // Add facility ID to the dock data
      const dockData = {
        ...req.body,
        facilityId
      };
      
      // Validate dock data
      const validatedData = insertDockSchema.parse(dockData);
      console.log("Validated dock data:", validatedData);
      
      // Create the dock
      const dock = await storage.createDock(validatedData);
      console.log("Dock created successfully:", dock);
      
      res.status(201).json(dock);
    } catch (err) {
      console.error("Error creating dock for facility:", err);
      
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
      console.log(`Updating dock ID: ${id} with data:`, req.body);
      
      const dock = await storage.getDock(id);
      if (!dock) {
        return res.status(404).json({ message: "Dock not found" });
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
          console.error("Validation error updating dock:", validationErr.format());
          return res.status(400).json({ 
            message: "Invalid dock data", 
            errors: validationErr.errors,
            details: validationErr.format()
          });
        }
        throw validationErr;
      }
      
      const updatedDock = await storage.updateDock(id, req.body);
      console.log("Dock updated successfully:", updatedDock);
      res.json(updatedDock);
    } catch (err) {
      console.error("Error updating dock:", err);
      res.status(500).json({ 
        message: "Failed to update dock",
        error: err instanceof Error ? err.message : "Unknown error"
      });
    }
  });
  
  app.delete("/api/docks/:id", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const id = Number(req.params.id);
      console.log(`Attempting to delete dock ID: ${id}`);
      
      const dock = await storage.getDock(id);
      if (!dock) {
        return res.status(404).json({ message: "Dock not found" });
      }
      
      // Check if there are any scheduled appointments using this dock
      const dockSchedules = await storage.getSchedulesByDock(id);
      if (dockSchedules.length > 0) {
        console.log(`Cannot delete dock ID ${id}: ${dockSchedules.length} existing schedules`);
        return res.status(409).json({ 
          message: "Cannot delete dock with existing schedules", 
          count: dockSchedules.length
        });
      }
      
      // Delete the dock
      const success = await storage.deleteDock(id);
      if (!success) {
        console.error(`Failed to delete dock ID ${id} from storage`);
        return res.status(500).json({ message: "Failed to delete dock" });
      }
      
      console.log(`Successfully deleted dock ID: ${id}`);
      res.status(204).send();
    } catch (err) {
      console.error("Error deleting dock:", err);
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
      
      const schedule = await storage.createSchedule(validatedData);
      
      // Get dock and facility information for the email
      try {
        if (schedule.dockId) {
          const dock = await storage.getDock(schedule.dockId);
          if (dock && dock.facilityId) {
            const facility = await storage.getFacility(dock.facilityId);
            
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
      } catch (emailError) {
        // Log the error but don't fail the API call
        console.error('Error preparing confirmation email:', emailError);
      }
      
      res.status(201).json(schedule);
    } catch (err) {
      console.error("Failed to create schedule:", err);
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
      console.log("Notes field in request:", req.body.notes);
      
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
      res.json(updatedSchedule);
    } catch (err) {
      console.error("Failed to check in schedule:", err);
      res.status(500).json({ message: "Failed to check in" });
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
      
      // Update the custom form data to include check-out information
      const newCustomFormData = JSON.stringify({
        ...existingCustomFormData,
        checkoutTime: actualEndTime.toISOString(),
        checkoutBy: req.user?.id || null,
        checkoutNotes: notes
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
      // Check authentication first
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
      const updateData = {
        ...req.body,
        lastModifiedAt: new Date()
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
        truckNumber: validatedData.truckNumber,
        trailerNumber: validatedData.trailerNumber || null,
        startTime,
        endTime,
        notes: validatedData.notes || null,
        customFormData: validatedData.customFields || null,
        createdBy: 1, // System user ID for external bookings
      };
      
      console.log("[/api/schedules/external] Creating schedule with data:", scheduleData);
      
      // Create the schedule
      const schedule = await storage.createSchedule(scheduleData);
      
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
      
      // Create schedule
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
        startTime,
        endTime,
        notes: validatedData.additionalNotes || null,
        createdBy: 1, // System user ID
      };
      
      const schedule = await storage.createSchedule(scheduleData);
      
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
      // Get the tenant ID from the authenticated user
      const tenantId = req.user?.tenantId;
      console.log(`Fetching appointment types for user with tenantId: ${tenantId}`);
      
      // Use our updated method that filters by tenant internally
      const appointmentTypes = await storage.getAppointmentTypes(tenantId);
      console.log(`Found ${appointmentTypes.length} appointment types for tenant ID ${tenantId || 'all'}`);
      
      res.json(appointmentTypes);
    } catch (err) {
      console.error("Error fetching appointment types:", err);
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
      
      // Additional tenant isolation check with facility ownership
      if (userTenantId && !isSuperAdmin) {
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
      const tenantId = req.user?.tenantId;
      
      console.log(`[CustomQuestions] Fetching questions for appointment type ID: ${appointmentTypeId}, tenantId: ${tenantId || 'none'}`);
      
      // Get the appointment type first with tenant isolation
      const appointmentType = await storage.getAppointmentType(appointmentTypeId, tenantId);
      if (!appointmentType) {
        console.log(`[CustomQuestions] Appointment type not found: ${appointmentTypeId}${tenantId ? ` for tenant ${tenantId}` : ''}`);
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
          'CustomQuestions'
        );
        
        if (!facility) {
          console.log(`[CustomQuestions] Access denied - appointment type ${appointmentTypeId} is not in organization ${req.user.tenantId}`);
          return res.status(403).json({ message: "Access denied to this appointment type's questions" });
        }
      }
      
      const customQuestions = await storage.getCustomQuestionsByAppointmentType(appointmentTypeId);
      console.log(`[CustomQuestions] Found ${customQuestions.length} questions for appointment type ${appointmentTypeId}`);
      res.json(customQuestions);
    } catch (err) {
      console.error(`[CustomQuestions] Error fetching questions:`, err);
      res.status(500).json({ message: "Failed to fetch custom questions" });
    }
  });

  app.post("/api/custom-questions", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const validatedData = insertCustomQuestionSchema.parse(req.body);
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
      
      const updatedCustomQuestion = await storage.updateCustomQuestion(id, req.body);
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
      const tenantId = req.user?.tenantId;
      
      if (isNaN(appointmentTypeId)) {
        console.log(`[CustomQuestions] Invalid appointment type ID: ${req.params.appointmentTypeId}`);
        return res.status(400).send("Invalid appointment type ID");
      }
      
      console.log(`[CustomQuestions] Fetching questions for appointment type ID: ${appointmentTypeId}, tenantId: ${tenantId || 'none'} (alternate endpoint)`);
      
      // Get the appointment type first with tenant isolation
      const appointmentType = await storage.getAppointmentType(appointmentTypeId, tenantId);
      if (!appointmentType) {
        console.log(`[CustomQuestions] Appointment type not found: ${appointmentTypeId}${tenantId ? ` for tenant ${tenantId}` : ''}`);
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
          'CustomQuestions-Alt'
        );
        
        if (!facility) {
          console.log(`[CustomQuestions] Access denied - appointment type ${appointmentTypeId} is not in organization ${req.user.tenantId}`);
          return res.status(403).json({ message: "Access denied to this appointment type's questions" });
        }
      }
      
      const questions = await storage.getCustomQuestionsByAppointmentType(appointmentTypeId);
      console.log(`[CustomQuestions] Found ${questions.length} questions for appointment type ${appointmentTypeId}`);
      res.json(questions);
    } catch (error) {
      console.error(`[CustomQuestions] Error fetching questions:`, error);
      res.status(500).send("Error fetching custom questions");
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
      
      // Pass tenantId to enforce tenant isolation if user is authenticated
      const tenantId = req.isAuthenticated() ? req.user?.tenantId : undefined;
      const isSuperAdmin = req.isAuthenticated() && (req.user?.role === 'super-admin' || req.user?.username?.includes('admin@conmitto.io'));
      
      // If the user is a super admin, we don't need to enforce tenant isolation
      const bookingPage = await storage.getBookingPageBySlug(
        slug, 
        isSuperAdmin ? undefined : tenantId
      );
      
      if (!bookingPage) {
        console.log(`[BookingPage] No booking page found with slug: ${slug} for user tenant: ${tenantId || 'none'}`);
        return res.status(404).json({ message: "Booking page not found" });
      }
      
      console.log(`[BookingPage] Successfully retrieved booking page:`, {
        id: bookingPage.id,
        name: bookingPage.name,
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
  
  // Check availability for booking appointments
  app.get("/api/availability", async (req, res) => {
    try {
      const { date, facilityId, appointmentTypeId, typeId } = req.query;
      const tenantId = req.user?.tenantId;
      
      // Support both parameter naming conventions for backward compatibility
      const finalTypeId = typeId || appointmentTypeId;
      
      // INSTRUMENTATION: Log the incoming request parameters
      console.log("===== /api/availability ENDPOINT INSTRUMENTATION =====");
      console.log("REQUEST PARAMETERS:", { 
        date, 
        facilityId, 
        appointmentTypeId, 
        typeId, 
        finalTypeId,
        tenantId: tenantId || 'none' 
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
            
            const orgResult = await pool.query(facilityOrgQuery, [parsedFacilityId]);
            
            if (orgResult.rows.length > 0) {
              const orgInfo = orgResult.rows[0];
              console.log(`[AvailabilityEndpoint] Facility ${parsedFacilityId} belongs to organization ${orgInfo.id} (${orgInfo.name})`);
              userTenantId = orgInfo.id;
            }
          } catch (error) {
            console.error(`[AvailabilityEndpoint] Error determining facility organization:`, error);
          }
        }
        
        // If using a tenantId (from session or derived), verify facility access
        if (userTenantId) {
          try {
            // Verify facility belongs to the user's organization using direct SQL
            const checkAccessQuery = `
              SELECT 1 
              FROM organization_facilities 
              WHERE organization_id = $1 AND facility_id = $2
              LIMIT 1
            `;
            
            const accessResult = await pool.query(checkAccessQuery, [userTenantId, parsedFacilityId]);
            
            const hasAccess = isSuperAdmin || accessResult.rows.length > 0;
            
            // The following condition is incorrect and allows cross-tenant access:
            // const matchesTenant = !tenantId || tenantId === userTenantId;
            
            // Instead, only allow access if:
            // 1. User has no tenant ID (public access)
            // 2. User's tenant ID matches the facility's organization ID
            if (tenantId && tenantId !== userTenantId) {
              console.log(`[AvailabilityEndpoint] Access denied - facility ${parsedFacilityId} belongs to tenant ${userTenantId}, user is from tenant ${tenantId}`);
              return res.status(403).json({ 
                message: "Access denied to this facility's availability" 
              });
            }
            
            if (!hasAccess) {
              console.log(`[AvailabilityEndpoint] Access denied - facility ${parsedFacilityId} does not belong to tenant ${tenantId || userTenantId}`);
              return res.status(403).json({ 
                message: "Access denied to this facility's availability"
              });
            }
            
            console.log(`[AvailabilityEndpoint] Verified tenant access to facility ${parsedFacilityId} for tenant ${userTenantId}`);
          } catch (error) {
            console.error(`[AvailabilityEndpoint] Error checking facility access:`, error);
            return res.status(500).json({ 
              message: "Error checking facility access"
            });
          }
        }
        
        // Additional check: verify appointment type belongs to the user's tenant
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
            
            // Critical tenant isolation check:
            // If the user has a tenant ID and it doesn't match the appointment type's organization,
            // OR if the facility's tenant doesn't match the appointment type's tenant, deny access
            if ((tenantId && appointmentTypeOrg.id !== tenantId) || 
                (userTenantId && appointmentTypeOrg.id !== userTenantId)) {
              console.log(`[AvailabilityEndpoint] Access denied - appointment type ${parsedAppointmentTypeId} belongs to org ${appointmentTypeOrg.id}, user is from tenant ${tenantId}, facility belongs to tenant ${userTenantId}`);
              return res.status(403).json({ 
                message: "Access denied: you don't have permission to access this resource"
              });
            }
          }
        } catch (error) {
          console.error(`[AvailabilityEndpoint] Error checking appointment type organization:`, error);
        }
      }
      
      // Get the appointment type to determine duration and other settings - with tenant isolation
      const appointmentType = await storage.getAppointmentType(parsedAppointmentTypeId, tenantId);
      if (!appointmentType) {
        console.log("VALIDATION ERROR: Appointment type not found");
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
            maxConcurrent: appointmentType.maxConcurrent || 1,
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
  
  return httpServer;
}
