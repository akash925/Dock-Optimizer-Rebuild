import { Router } from "express";
import { getStorage } from "../../storage";
import { isAuthenticated } from "../../middleware/auth";

const router = Router();

// Get all facilities
router.get("/facilities", isAuthenticated, async (req, res) => {
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
router.get("/facilities/:id", isAuthenticated, async (req, res) => {
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
router.post("/facilities", isAuthenticated, async (req, res) => {
  try {
    const storage = await getStorage();
    const user = req.user as any;
    
    const facility = await storage.createFacility(req.body);
    
    // Associate facility with user's organization if they have one
    if (user?.tenantId) {
      // Insert into organization_facilities table directly via database
      const { db } = require("../../db");
      const { organizationFacilities } = require("@shared/schema");
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
router.put("/facilities/:id", isAuthenticated, async (req, res) => {
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
router.delete("/facilities/:id", isAuthenticated, async (req, res) => {
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

export default router;