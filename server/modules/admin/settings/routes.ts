import express, { Request, Response, NextFunction } from "express";
import { getStorage } from "../../../storage";
import { z } from "zod";
import { db } from "../../../db";
import { roles } from "@shared/schema";
import { eq } from "drizzle-orm";

const router = express.Router();

// Middleware to check if user is a super-admin
const requireSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (req.user?.role !== "super-admin") {
    return res.status(403).json({ message: "Access denied. Super admin role required." });
  }

  next();
};

router.use(requireSuperAdmin);

// GET /api/admin/settings/roles - Get all roles
router.get("/roles", async (req: Request, res: Response) => {
  try {
    const storage = await getStorage();
    const allRoles = await storage.getRoles();
    
    res.json(allRoles);
  } catch (error: unknown) {
    console.error("Error fetching roles:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: "Failed to fetch roles", error: errorMessage });
  }
});

// Define role update schema
const updateRoleSchema = z.object({
  name: z.string().min(1, "Role name is required"),
  description: z.string().optional(),
});

// PUT /api/admin/settings/roles/:roleId - Update role
router.put("/roles/:roleId", async (req: Request, res: Response) => {
  try {
    const roleId = Number(req.params.roleId);
    if (isNaN(roleId)) {
      return res.status(400).json({ message: "Invalid role ID" });
    }

    const validatedData = updateRoleSchema.parse(req.body);
    
    const storage = await getStorage();
    const role = await storage.getRole(roleId);
    
    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }
    
    // Update role in database
    const updatedRole = await db.update(roles)
      .set({
        name: validatedData.name,
        description: validatedData.description,
      })
      .where(eq(roles.id, roleId))
      .returning();
    
    res.json(updatedRole[0]);
  } catch (error: unknown) {
    console.error("Error updating role:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: "Invalid role data", 
        errors: error.errors 
      });
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: "Failed to update role", error: errorMessage });
  }
});

// GET /api/admin/settings/feature-flags - Get all feature flags
router.get("/feature-flags", async (req: Request, res: Response) => {
  try {
    // Temporarily using mock data for feature flags since the interface isn't established yet
    const featureFlags = [
      {
        name: "enableAssetManager",
        description: "Enable the Asset Manager module globally",
        enabled: true
      },
      {
        name: "enableCalendar",
        description: "Enable the Calendar view module globally",
        enabled: true
      },
      {
        name: "enableAnalytics", 
        description: "Enable the Analytics module globally",
        enabled: true
      },
      {
        name: "enableEmailNotifications",
        description: "Enable email notifications for appointments",
        enabled: true
      },
      {
        name: "enableBookingPages",
        description: "Enable public booking pages",
        enabled: true
      }
    ];
    
    res.json(featureFlags);
  } catch (error: unknown) {
    console.error("Error fetching feature flags:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: "Failed to fetch feature flags", error: errorMessage });
  }
});

// Define feature flag update schema
const updateFeatureFlagSchema = z.object({
  enabled: z.boolean(),
  description: z.string().optional(),
});

// PUT /api/admin/settings/feature-flags/:flagName - Update feature flag
router.put("/feature-flags/:flagName", async (req: Request, res: Response) => {
  try {
    const flagName = req.params.flagName;
    if (!flagName) {
      return res.status(400).json({ message: "Invalid feature flag name" });
    }

    const validatedData = updateFeatureFlagSchema.parse(req.body);
    
    // This would be where we'd update the feature flag in a real implementation
    // For now, just return a mock success response
    const updatedFlag = {
      name: flagName,
      enabled: validatedData.enabled,
      description: validatedData.description || `Toggle for ${flagName} feature`
    };
    
    res.json(updatedFlag);
  } catch (error: unknown) {
    console.error("Error updating feature flag:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: "Invalid feature flag data", 
        errors: error.errors 
      });
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: "Failed to update feature flag", error: errorMessage });
  }
});

export default router;