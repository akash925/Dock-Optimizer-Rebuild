import { Router, Request, Response, NextFunction } from "express";
import { getStorage } from "../../../storage";
import { roles } from "@shared/schema";
import { eq } from "drizzle-orm";
import { db } from "../../../db";

// Super admin middleware
const isSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  if (req.user?.role !== 'super-admin') {
    return res.status(403).json({ message: 'Not authorized. Super admin access required.' });
  }

  next();
};

const router = Router();

// Get a list of roles
router.get("/roles", isSuperAdmin, async (req, res) => {
  try {
    const storage = await getStorage();
    const allRoles = await storage.getRoles();
    res.json(allRoles);
  } catch (error) {
    console.error("Error fetching roles:", error);
    res.status(500).json({ message: "Failed to fetch roles" });
  }
});

// Update a role
router.put("/roles/:id", isSuperAdmin, async (req, res) => {
  const roleId = parseInt(req.params.id);
  if (isNaN(roleId)) {
    return res.status(400).json({ message: "Invalid role ID" });
  }

  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ message: "Role name is required" });
    }

    // Check if role exists
    const roleExists = await db.select().from(roles).where(eq(roles.id, roleId));
    if (roleExists.length === 0) {
      return res.status(404).json({ message: "Role not found" });
    }

    // Update the role
    const [updatedRole] = await db
      .update(roles)
      .set({
        name,
        description: description || null,
      })
      .where(eq(roles.id, roleId))
      .returning();

    res.json(updatedRole);
  } catch (error) {
    console.error("Error updating role:", error);
    res.status(500).json({ message: "Failed to update role" });
  }
});

// Get a list of feature flags
router.get("/feature-flags", isSuperAdmin, async (req, res) => {
  try {
    // Example feature flags - in a real implementation, these would come from a database
    const featureFlags = [
      {
        name: "EMAIL_NOTIFICATIONS",
        description: "Enable or disable system-wide email notifications",
        enabled: true,
      },
      {
        name: "MAINTENANCE_MODE",
        description: "Put the application in maintenance mode (read-only)",
        enabled: false,
      },
      {
        name: "BETA_FEATURES",
        description: "Enable beta features across the application",
        enabled: false,
      },
    ];

    res.json(featureFlags);
  } catch (error) {
    console.error("Error fetching feature flags:", error);
    res.status(500).json({ message: "Failed to fetch feature flags" });
  }
});

// Update a feature flag
router.put("/feature-flags/:name", isSuperAdmin, async (req, res) => {
  const { name } = req.params;
  const { enabled } = req.body;

  if (typeof enabled !== "boolean") {
    return res.status(400).json({ message: "Enabled must be a boolean value" });
  }

  try {
    // Here we would update the feature flag in the database
    // For now, we just return a success response with the updated flag
    res.json({
      name,
      enabled,
      description: "Updated feature flag", // In a real implementation, this would come from the database
    });
  } catch (error) {
    console.error(`Error updating feature flag ${name}:`, error);
    res.status(500).json({ message: "Failed to update feature flag" });
  }
});

export default router;