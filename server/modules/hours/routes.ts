import { Express, Request, Response } from 'express';
import { getStorage } from '../../storage';

export const registerHoursRoutes = (app: Express) => {
  // New endpoint for organization hours with better default handling
  app.get('/api/org/hours', async (req: Request, res: Response) => {
    if (!isAuthenticated(req)) {
      return res.status(401).json({ error: "Authentication required" });
    }
    console.log('[OrgHours] Request received for organization hours');
    try {
      let tenantId: number | null = null;
      
      // Check if we have a booking page slug (for external booking flow)
      const bookingPageSlug = req.query.bookingPageSlug as string;
      if (bookingPageSlug) {
        console.log(`[OrgHours] Request includes booking page slug: ${bookingPageSlug}`);
        try {
          const storage = await getStorage();
          // Get the booking page to determine the correct tenant context
          const bookingPage = await storage.getBookingPageBySlug(bookingPageSlug);
          if (bookingPage) {
            tenantId = bookingPage.tenantId;
            console.log(`[OrgHours] Using tenant ID ${tenantId} from booking page ${bookingPageSlug}`);
          } else {
            console.warn(`[OrgHours] Booking page not found: ${bookingPageSlug}`);
            return res.status(404).json({ message: "Booking page not found" });
          }
        } catch (err) {
          console.error(`[OrgHours] Error retrieving booking page ${bookingPageSlug}:`, err);
          return res.status(500).json({ message: "Error retrieving booking page" });
        }
      } else if (req.isAuthenticated?.() && req.user?.tenantId) {
        // Use authenticated user's tenant ID
        tenantId = req.user?.tenantId;
        console.log(`[OrgHours] Using authenticated user's tenant ID: ${tenantId}`);
      } else if (req.query.organizationId) {
        // Use organization ID from query params
        tenantId = parseInt(req.query.organizationId as string);
        if (isNaN(tenantId)) {
          console.error(`[OrgHours] Invalid organization ID: ${req.query.organizationId}`);
          return res.status(400).json({ message: "Invalid organization ID" });
        }
        console.log(`[OrgHours] Using organization ID from query params: ${tenantId}`);
      } else {
        console.error('[OrgHours] No tenant context provided');
        return res.status(400).json({ error: "Tenant required" });
      }
      
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant required" });
      }
      
      const storage = await getStorage();
      
      // Get organization default hours
      const defaultHours = await storage.getOrganizationDefaultHours(tenantId);
      
      // Return default business hours if none are configured
      if (!defaultHours) {
        console.log(`[OrgHours] No hours found for organization ${tenantId}, returning default business hours`);
        
        // Default business hours (9 AM to 5 PM, Mon-Fri)
        const defaultBusinessHours = {
          monday: { open: true, start: "09:00", end: "17:00" },
          tuesday: { open: true, start: "09:00", end: "17:00" },
          wednesday: { open: true, start: "09:00", end: "17:00" },
          thursday: { open: true, start: "09:00", end: "17:00" },
          friday: { open: true, start: "09:00", end: "17:00" },
          saturday: { open: false, start: "09:00", end: "17:00" },
          sunday: { open: false, start: "09:00", end: "17:00" }
        };
        
        return res.json(defaultBusinessHours);
      }
      
      console.log(`[OrgHours] Returning hours for organization ${tenantId}`);
      res.json(defaultHours);
    } catch (error) {
      console.error('[OrgHours] Error fetching organization hours:', error);
      res.status(500).json({ 
        message: "Failed to fetch organization hours", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
};