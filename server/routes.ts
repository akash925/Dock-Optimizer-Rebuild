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

// Import the super-admin creation script
import { createSuperAdmin } from "./create-super-admin";
import { fixAdminPassword } from "./fix-admin-password";
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
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: "Search query is required" });
      }
      
      const results = await storage.searchSchedules(query);
      
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
      if (!code) {
        return res.status(400).json({ error: "Confirmation code is required" });
      }
      
      const schedule = await storage.getScheduleByConfirmationCode(code);
      if (!schedule) {
        return res.status(404).json({ error: "No schedule found with the provided confirmation code" });
      }
      
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
      
      if (startDate && endDate) {
        schedules = await storage.getSchedulesByDateRange(
          new Date(startDate as string),
          new Date(endDate as string)
        );
      } else {
        try {
          schedules = await storage.getSchedules();
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
  
  // Check-in endpoint - starts appointment
  app.patch("/api/schedules/:id/check-in", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const schedule = await storage.getSchedule(id);
      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }
      
      // Update schedule status to in-progress and set actual start time
      const scheduleData = {
        status: "in-progress",
        actualStartTime: new Date(),
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
      
      // Update schedule status to completed and set actual end time
      const scheduleData = {
        status: "completed",
        actualEndTime: new Date(),
        lastModifiedBy: req.user?.id || null,
        lastModifiedAt: new Date()
      };
      
      const updatedSchedule = await storage.updateSchedule(id, scheduleData);
      res.json(updatedSchedule);
    } catch (err) {
      console.error("Failed to check out schedule:", err);
      res.status(500).json({ message: "Failed to check out" });
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
      const facilities = await storage.getFacilities();
      res.json(facilities);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch facilities" });
    }
  });

  app.get("/api/facilities/:id", async (req, res) => {
    try {
      const facility = await storage.getFacility(Number(req.params.id));
      if (!facility) {
        return res.status(404).json({ message: "Facility not found" });
      }
      res.json(facility);
    } catch (err) {
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
      const users = await storage.getUsers();
      // Remove passwords from the response
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (err) {
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
            
          // Send confirmation email with enhanced information
          sendConfirmationEmail(
            validatedData.email,
            `HC${schedule.id}`,
            {
              id: schedule.id,
              dockName: dockName,
              facilityName: facility?.name || 'Main Facility',
              startTime: new Date(schedule.startTime),
              endTime: new Date(schedule.endTime),
              truckNumber: schedule.truckNumber || '',
              customerName: schedule.customerName || undefined,
              type: validatedData.pickupOrDropoff === 'pickup' ? 'pickup' : 'delivery',
              // Add additional fields for enhanced email
              driverName: validatedData.driverName || schedule.driverName || undefined,
              driverPhone: validatedData.driverPhone || schedule.driverPhone || undefined,
              carrierName: validatedData.carrierName || schedule.carrierName || undefined,
              mcNumber: validatedData.mcNumber || schedule.mcNumber || undefined,
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
          
          // Send confirmation email with enhanced information
          sendConfirmationEmail(
            validatedData.contactEmail,
            `HC${schedule.id}`,
            {
              id: schedule.id,
              dockName: "Not scheduled yet", // Default for legacy external bookings
              facilityName: facility?.name || validatedData.location || 'Main Facility',
              startTime: startTime,
              endTime: endTime,
              truckNumber: schedule.truckNumber || '',
              customerName: validatedData.customerName || null,
              type: validatedData.pickupOrDropoff === 'pickup' ? 'pickup' : 'delivery',
              status: "scheduled",
              createdAt: schedule.createdAt,
              createdBy: schedule.createdBy,
              lastModifiedAt: schedule.lastModifiedAt,
              lastModifiedBy: schedule.lastModifiedBy,
              // Add additional fields for enhanced email
              driverName: validatedData.driverName || schedule.driverName || null,
              driverPhone: validatedData.driverPhone || schedule.driverPhone || null,
              driverEmail: validatedData.contactEmail || null,
              carrierId: schedule.carrierId,
              carrierName: validatedData.carrierName || schedule.carrierName || null,
              mcNumber: validatedData.mcNumber || schedule.mcNumber || null,
              facilityId: facility?.id || null,
              trailerNumber: schedule.trailerNumber,
              dockId: null,
              notes: schedule.notes,
              appointmentTypeId: null,
              appointmentMode: null,
              appointmentTypeName: validatedData.appointmentType || 'Standard Appointment',
              timezone: facility?.timezone || 'America/New_York',
              customFormData: null,
              actualStartTime: null,
              actualEndTime: null,
              bolNumber: null,
              poNumber: null,
              palletCount: null,
              weight: null
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
      const facility = await storage.getFacility(facilityId);
      if (!facility) {
        return res.status(404).json({ message: "Facility not found" });
      }

      const settings = await storage.getAppointmentSettings(facilityId);
      if (!settings) {
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
      const facility = await storage.getFacility(facilityId);
      if (!facility) {
        return res.status(404).json({ message: "Facility not found" });
      }

      // Check if settings already exist
      const existingSettings = await storage.getAppointmentSettings(facilityId);
      if (existingSettings) {
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
      const facility = await storage.getFacility(facilityId);
      if (!facility) {
        return res.status(404).json({ message: "Facility not found" });
      }

      // Check if settings exist
      const existingSettings = await storage.getAppointmentSettings(facilityId);
      if (!existingSettings) {
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
      const appointmentTypes = await storage.getAppointmentTypes();
      console.log("Appointment types fetched:", appointmentTypes);
      res.json(appointmentTypes);
    } catch (err) {
      console.error("Error fetching appointment types:", err);
      res.status(500).json({ message: "Failed to fetch appointment types", error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/api/appointment-types/:id", async (req, res) => {
    try {
      const appointmentType = await storage.getAppointmentType(Number(req.params.id));
      if (!appointmentType) {
        return res.status(404).json({ message: "Appointment type not found" });
      }
      res.json(appointmentType);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch appointment type" });
    }
  });

  app.get("/api/facilities/:id/appointment-types", async (req, res) => {
    try {
      const facilityId = Number(req.params.id);
      console.log(`[AppointmentTypes] Fetching appointment types for facility ID: ${facilityId}`);
      
      const facility = await storage.getFacility(facilityId);
      if (!facility) {
        console.log(`[AppointmentTypes] Facility ID ${facilityId} not found`);
        return res.status(404).json({ message: "Facility not found" });
      }
      
      const appointmentTypes = await storage.getAppointmentTypesByFacility(facilityId);
      console.log(`[AppointmentTypes] Found ${appointmentTypes.length} appointment types for facility ID ${facilityId}`);
      
      // Optional query parameter to filter by booking page
      const bookingPageId = req.query.bookingPageId ? Number(req.query.bookingPageId) : null;
      
      if (bookingPageId) {
        console.log(`[AppointmentTypes] Filtering by booking page ID: ${bookingPageId}`);
        
        // Get the booking page to check excluded appointment types
        const bookingPage = await storage.getBookingPage(bookingPageId);
        
        if (!bookingPage) {
          console.log(`[AppointmentTypes] Booking page ID ${bookingPageId} not found`);
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
      const validatedData = insertAppointmentTypeSchema.parse(req.body);
      
      // Check if facility exists
      const facility = await storage.getFacility(validatedData.facilityId);
      if (!facility) {
        return res.status(400).json({ message: "Invalid facility ID" });
      }
      
      const appointmentType = await storage.createAppointmentType(validatedData);
      res.status(201).json(appointmentType);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid appointment type data", errors: err.errors });
      }
      res.status(500).json({ message: "Failed to create appointment type" });
    }
  });

  app.put("/api/appointment-types/:id", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const appointmentType = await storage.getAppointmentType(id);
      if (!appointmentType) {
        return res.status(404).json({ message: "Appointment type not found" });
      }
      
      const updatedAppointmentType = await storage.updateAppointmentType(id, req.body);
      res.json(updatedAppointmentType);
    } catch (err) {
      res.status(500).json({ message: "Failed to update appointment type" });
    }
  });

  app.delete("/api/appointment-types/:id", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const appointmentType = await storage.getAppointmentType(id);
      if (!appointmentType) {
        return res.status(404).json({ message: "Appointment type not found" });
      }
      
      // Check if there are any schedules using this appointment type
      const schedules = await storage.getSchedules();
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
      const dailyAvailability = await storage.getDailyAvailabilityByAppointmentType(appointmentTypeId);
      res.json(dailyAvailability);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch daily availability" });
    }
  });
  
  // Availability rules endpoint
  app.get("/api/appointment-master/availability-rules", async (req, res) => {
    try {
      const { typeId, appointmentTypeId, facilityId } = req.query;
      
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
        facilityId
      });
      
      // Check if appointment type exists
      const appointmentType = await storage.getAppointmentType(appointmentTypeIdNum);
      if (!appointmentType) {
        return res.status(404).json({ message: "Appointment type not found" });
      }
      
      // Verify that the appointment type belongs to the specified facility
      if (appointmentType.facilityId !== facilityIdNum) {
        return res.status(400).json({ 
          message: "The specified appointment type does not belong to the specified facility" 
        });
      }
      
      // Get availability rules for this appointment type
      const dailyRules = await storage.getDailyAvailabilityByAppointmentType(appointmentTypeIdNum);
      
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
      
      // Check if appointment type exists
      const appointmentType = await storage.getAppointmentType(validatedData.appointmentTypeId);
      if (!appointmentType) {
        return res.status(400).json({ message: "Invalid appointment type ID" });
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
      const dailyAvailability = await storage.getDailyAvailability(id);
      if (!dailyAvailability) {
        return res.status(404).json({ message: "Daily availability not found" });
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
      const customQuestions = await storage.getCustomQuestionsByAppointmentType(appointmentTypeId);
      res.json(customQuestions);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch custom questions" });
    }
  });

  app.post("/api/custom-questions", checkRole(["admin", "manager"]), async (req, res) => {
    try {
      const validatedData = insertCustomQuestionSchema.parse(req.body);
      
      // Check if appointment type exists if appointmentTypeId is provided
      if (validatedData.appointmentTypeId) {
        const appointmentType = await storage.getAppointmentType(validatedData.appointmentTypeId);
        if (!appointmentType) {
          return res.status(400).json({ message: "Invalid appointment type ID" });
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
      const customQuestion = await storage.getCustomQuestion(id);
      if (!customQuestion) {
        return res.status(404).json({ message: "Custom question not found" });
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
      const customQuestion = await storage.getCustomQuestion(id);
      if (!customQuestion) {
        return res.status(404).json({ message: "Custom question not found" });
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
      if (isNaN(appointmentTypeId)) {
        return res.status(400).send("Invalid appointment type ID");
      }
      
      const questions = await storage.getCustomQuestionsByAppointmentType(appointmentTypeId);
      res.json(questions);
    } catch (error) {
      console.error("Error fetching custom questions:", error);
      res.status(500).send("Error fetching custom questions");
    }
  });

  // Booking Pages routes
  app.get("/api/booking-pages", async (req, res) => {
    try {
      const bookingPages = await storage.getBookingPages();
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
      
      const bookingPage = await storage.getBookingPageBySlug(slug);
      if (!bookingPage) {
        console.log(`[BookingPage] No booking page found with slug: ${slug}`);
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
      const bookingPage = await storage.getBookingPage(Number(req.params.id));
      if (!bookingPage) {
        return res.status(404).json({ message: "Booking page not found" });
      }
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
      
      // Add the current user to createdBy field
      const bookingPageData = {
        ...req.body,
        createdBy: req.user!.id
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
        excludedAppointmentTypes: excludedAppointmentTypes // For backward compatibility
      };
      
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
      
      const bookingPage = await storage.getBookingPage(id);
      if (!bookingPage) {
        console.log(`[BookingPage] Error: Booking page ${id} not found`);
        return res.status(404).json({ message: "Booking page not found" });
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
        excludedAppointmentTypes: excludedAppointmentTypes // For backward compatibility
      };
      
      // Remove the raw appointmentTypes from the data to save to avoid confusion with excludedAppointmentTypes
      delete dataToSave.appointmentTypes;
      
      console.log(`[BookingPage] Updating booking page ${id} with:`, {
        facilities: parsedFacilities.length,
        includedAppointmentTypes: parsedAppointmentTypes.length,
        excludedAppointmentTypes: excludedAppointmentTypes.length
      });
      
      console.log(`[BookingPage] Full update payload:`, JSON.stringify(dataToSave, null, 2));
      
      const updatedBookingPage = await storage.updateBookingPage(id, dataToSave);
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
      const bookingPage = await storage.getBookingPage(id);
      if (!bookingPage) {
        return res.status(404).json({ message: "Booking page not found" });
      }
      
      const success = await storage.deleteBookingPage(id);
      if (success) {
        res.status(204).send();
      } else {
        res.status(500).json({ message: "Failed to delete booking page" });
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
  
  // Configure storage for file uploads
  const multerStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, `schedule-${req.params.id}-${uniqueSuffix}${ext}`);
    }
  });
  
  const upload = multer({ 
    storage: multerStorage,
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
  
  // Release door endpoint (with optional notes and photo)
  // Upload BOL endpoint
  app.post("/api/upload-bol", upload.single('bolFile'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      // Generate a URL for the uploaded file
      const fileUrl = `/uploads/${req.file.filename}`;
      
      // Return success with the file URL
      return res.status(200).json({ 
        fileUrl,
        filename: req.file.filename,
        size: req.file.size,
        message: 'BOL file uploaded successfully' 
      });
    } catch (error) {
      console.error('Error uploading BOL file:', error);
      return res.status(500).json({ error: 'Failed to upload BOL file' });
    }
  });

  app.post("/api/schedules/:id/release", upload.single('photo'), async (req, res) => {
    try {
      console.log("=== RELEASE DOOR START ===");
      const id = Number(req.params.id);
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
      
      // Update schedule with notes, photo, and mark as completed
      const scheduleData = {
        status: "completed", // Mark as completed instead of trying to clear dockId
        actualEndTime: new Date(),
        notes: notes || schedule.notes,
        lastModifiedBy: req.user?.id || null,
        lastModifiedAt: new Date(),
        // Store photo information in custom form data if available
        customFormData: photoInfo ? JSON.stringify({
          ...(schedule.customFormData ? 
              (typeof schedule.customFormData === 'string' ? 
                JSON.parse(schedule.customFormData) : 
                schedule.customFormData) 
              : {}),
          releasePhoto: photoInfo
        }) : schedule.customFormData
      };
      
      const updatedSchedule = await storage.updateSchedule(id, scheduleData);
      
      // Return updated schedule with photo information
      res.json({
        ...updatedSchedule,
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
      
      // Support both parameter naming conventions for backward compatibility
      const finalTypeId = typeId || appointmentTypeId;
      
      // INSTRUMENTATION: Log the incoming request parameters
      console.log("===== /api/availability ENDPOINT INSTRUMENTATION =====");
      console.log("REQUEST PARAMETERS:", { date, facilityId, appointmentTypeId, typeId, finalTypeId });
      
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
      
      // Get the appointment type to determine duration and other settings
      const appointmentType = await storage.getAppointmentType(parsedAppointmentTypeId);
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
      
      // Check if appointment type belongs to the requested facility
      if (appointmentType.facilityId !== parsedFacilityId) {
        console.log("VALIDATION ERROR: Appointment type does not belong to facility");
        return res.status(400).json({ 
          message: "The appointment type does not belong to the specified facility" 
        });
      }
      
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
          // Use the buffer time as the interval if it exists and is greater than 0
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

  const httpServer = createServer(app);
  
  return httpServer;
}
