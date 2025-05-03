import { Express } from 'express';
import { getStorage } from '../storage';

export function registerBookingPagesLogoEndpoint(app: Express) {
  /**
   * Endpoint to get an organization logo by booking page slug
   * This allows public booking pages to display tenant-specific logos without requiring authentication
   */
  app.get('/api/booking-pages/logo/:slug', async (req, res) => {
    try {
      const { slug } = req.params;
      console.log(`[Booking Page Logo] Fetching logo for booking page with slug: ${slug}`);
      
      if (!slug) {
        return res.status(400).json({ message: 'Slug is required' });
      }
      
      const storage = await getStorage();
      
      // Get the booking page to determine the tenant ID
      const bookingPage = await storage.getBookingPageBySlug(slug);
      if (!bookingPage) {
        console.log(`[Booking Page Logo] Booking page with slug '${slug}' not found`);
        return res.status(404).json({ message: 'Booking page not found' });
      }
      
      console.log(`[Booking Page Logo] Found booking page '${bookingPage.name}' with tenant ID: ${bookingPage.tenantId}`);
      
      // No tenant ID, no logo
      if (!bookingPage.tenantId) {
        return res.status(404).json({ message: 'No tenant associated with this booking page' });
      }
      
      // Get the organization for this tenant ID
      const organization = await storage.getTenantById(bookingPage.tenantId);
      if (!organization) {
        console.log(`[Booking Page Logo] Organization with ID ${bookingPage.tenantId} not found`);
        return res.status(404).json({ message: 'Organization not found' });
      }
      
      console.log(`[Booking Page Logo] Found organization '${organization.name}' for tenant ID: ${bookingPage.tenantId}`);
      
      // Return the logo URL or data
      const logoData = organization.logo ? organization.logo : null;
      
      // Special case handling for known organizations
      if (bookingPage.tenantId === 5) { // Fresh Connect Central
        console.log(`[Booking Page Logo] Using custom logo path for Fresh Connect Central`);
        return res.json({ logo: '/src/assets/fresh-connect-logo.png' });
      } else if (bookingPage.tenantId === 2) { // Hanzo Logistics
        console.log(`[Booking Page Logo] Using custom logo path for Hanzo Logistics`);
        return res.json({ logo: '/src/assets/hanzo_logo.jpeg' });
      }
      
      // If we have logo data in the organization, return it
      if (logoData) {
        return res.json({ logo: logoData });
      }
      
      // Default fallback if no logo is found
      return res.json({ logo: null });
    } catch (error) {
      console.error('[Booking Page Logo] Error fetching logo:', error);
      return res.status(500).json({ message: 'Error fetching organization logo' });
    }
  });
}