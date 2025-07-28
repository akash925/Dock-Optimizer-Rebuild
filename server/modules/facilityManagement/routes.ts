import { Router, Request, Response } from "express";
import { getStorage } from "../../storage.js";
import { isAuthenticated } from "../../middleware/auth.js";
import { db } from "../../db.js";
import { organizationFacilities } from "@shared/schema";

const router = Router();

// Get all facilities
router.get("/facilities", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const storage = await getStorage();
    const user = req.user as any;
    const tenantId = user?.tenantId;
    
    const facilities = await storage.getFacilities(tenantId);
    res.json(facilities);
  } catch (error) {
    console.error("Error fetching facilities:", error);
    res.status(500).json({ error: "Failed to fetch facilities" });
  }
});

// Get facility by ID
router.get("/facilities/:id", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const storage = await getStorage();
    const facilityId = parseInt(req.params.id);
    const user = req.user as any;
    const tenantId = user?.tenantId;
    
    const facility = await storage.getFacility(facilityId, tenantId);
    if (!facility) {
      return res.status(404).json({ error: "Facility not found" });
    }
    
    res.json(facility);
  } catch (error) {
    console.error("Error fetching facility:", error);
    res.status(500).json({ error: "Failed to fetch facility" });
  }
});

// Create facility
router.post("/facilities", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const storage = await getStorage();
    const user = req.user as any;
    
    const facility = await storage.createFacility(req.body);
    
    // Associate facility with user's organization if they have one
    if (user?.tenantId) {
      // Insert into organization_facilities table directly via database
      await db.insert(organizationFacilities).values({
        organizationId: user.tenantId,
        facilityId: facility.id
      });
    }
    
    res.status(201).json(facility);
  } catch (error) {
    console.error("Error creating facility:", error);
    res.status(500).json({ error: "Failed to create facility" });
  }
});

// Update facility
router.put("/facilities/:id", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const storage = await getStorage();
    const facilityId = parseInt(req.params.id);
    
    const facility = await storage.updateFacility(facilityId, req.body);
    if (!facility) {
      return res.status(404).json({ error: "Facility not found" });
    }
    
    res.json(facility);
  } catch (error) {
    console.error("Error updating facility:", error);
    res.status(500).json({ error: "Failed to update facility" });
  }
});

// Delete facility
router.delete("/facilities/:id", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const storage = await getStorage();
    const facilityId = parseInt(req.params.id);
    
    await storage.deleteFacility(facilityId);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting facility:", error);
    res.status(500).json({ error: "Failed to delete facility" });
  }
});

// DOCK/DOOR MANAGEMENT ENDPOINTS

// Get docks for a facility
router.get("/facilities/:id/docks", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const storage = await getStorage();
    const facilityId = parseInt(req.params.id);
    const user = req.user as any;
    const tenantId = user?.tenantId;
    
    // Verify facility belongs to tenant
    const facility = await storage.getFacility(facilityId, tenantId);
    if (!facility) {
      return res.status(404).json({ error: "Facility not found" });
    }
    
    const docks = await storage.getDocksByFacility(facilityId);
    res.json(docks);
  } catch (error) {
    console.error("Error fetching facility docks:", error);
    res.status(500).json({ error: "Failed to fetch facility docks" });
  }
});

// Create dock for a facility
router.post("/facilities/:id/docks", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const storage = await getStorage();
    const facilityId = parseInt(req.params.id);
    const user = req.user as any;
    const tenantId = user?.tenantId;
    
    // Verify facility belongs to tenant
    const facility = await storage.getFacility(facilityId, tenantId);
    if (!facility) {
      return res.status(404).json({ error: "Facility not found" });
    }
    
    const dockData = {
      ...req.body,
      facilityId: facilityId
    };
    
    const dock = await storage.createDock(dockData);
    res.status(201).json(dock);
  } catch (error) {
    console.error("Error creating dock:", error);
    res.status(500).json({ error: "Failed to create dock" });
  }
});

// Update dock
router.put("/docks/:id", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const storage = await getStorage();
    const dockId = parseInt(req.params.id);
    const user = req.user as any;
    const tenantId = user?.tenantId;
    
    // Get the dock to verify facility ownership
    const existingDock = await storage.getDock?.(dockId);
    if (!existingDock) {
      return res.status(404).json({ error: "Dock not found" });
    }
    
    // Verify facility belongs to tenant
    const facility = await storage.getFacility(existingDock.facilityId, tenantId);
    if (!facility) {
      return res.status(403).json({ error: "Access denied to this dock" });
    }
    
    const dock = await storage.updateDock(dockId, req.body);
    res.json(dock);
  } catch (error) {
    console.error("Error updating dock:", error);
    res.status(500).json({ error: "Failed to update dock" });
  }
});

// Delete dock
router.delete("/docks/:id", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const storage = await getStorage();
    const dockId = parseInt(req.params.id);
    const user = req.user as any;
    const tenantId = user?.tenantId;
    
    // Get the dock to verify facility ownership
    const existingDock = await storage.getDock?.(dockId);
    if (!existingDock) {
      return res.status(404).json({ error: "Dock not found" });
    }
    
    // Verify facility belongs to tenant
    const facility = await storage.getFacility(existingDock.facilityId, tenantId);
    if (!facility) {
      return res.status(403).json({ error: "Access denied to this dock" });
    }
    
    await storage.deleteDock(dockId);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting dock:", error);
    res.status(500).json({ error: "Failed to delete dock" });
  }
});

export default router;