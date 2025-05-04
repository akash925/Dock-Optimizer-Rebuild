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
      
      // Check if booking page has useOrganizationLogo flag
      if (bookingPage.useOrganizationLogo === false) {
        // Use custom logo if available
        if (bookingPage.customLogo) {
          console.log(`[Booking Page Logo] Using custom logo from booking page: ${bookingPage.customLogo}`);
          return res.json({ logo: bookingPage.customLogo });
        } else {
          console.log(`[Booking Page Logo] useOrganizationLogo is false but no custom logo provided`);
        }
      }
      
      // If using organization logo (or fallback from above), use organization logo
      console.log(`[Booking Page Logo] Using organization logo for tenant ${bookingPage.tenantId}`);
      
      // First, check if we have actual logo data in the organization record
      if (logoData) {
        console.log(`[Booking Page Logo] Using logo from organization record for tenant ID ${bookingPage.tenantId}`);
        return res.json({ logo: logoData });
      }
      
      // For organizations without a logo in the database, use organization-specific logos
      let fallbackLogoPath;
      
      // Properly map organization names to their correct logos using correct paths
      // Note: These must match the paths that are actually served by the static files middleware
      // Absolute paths are resolved from the public directory
      if (organization.id === 5 || organization.name.includes('Fresh Connect')) {
        fallbackLogoPath = '/logo/fresh-connect-logo.png';
        console.log(`[Booking Page Logo] Using Fresh Connect logo path: ${fallbackLogoPath}`);
      } else if (organization.id === 2 || organization.name.includes('Hanzo')) {
        fallbackLogoPath = '/logo/hanzo-logo.png';
        console.log(`[Booking Page Logo] Using Hanzo logo path: ${fallbackLogoPath}`);
      } else {
        // Default fallback - use a generic path based on organization name
        const safeOrgName = organization.name.toLowerCase().replace(/\s+/g, '-');
        fallbackLogoPath = `/logo/${safeOrgName}-logo.png`;
        console.log(`[Booking Page Logo] Using dynamic logo path: ${fallbackLogoPath}`);
      }
      
      console.log(`[Booking Page Logo] Using organization-specific logo path for ${organization.name}: ${fallbackLogoPath}`);
      return res.json({ logo: fallbackLogoPath });
    } catch (error) {
      console.error('[Booking Page Logo] Error fetching logo:', error);
      return res.status(500).json({ message: 'Error fetching organization logo' });
    }
  });
}