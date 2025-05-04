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
      // These are the actual image files we have in the assets directory
      // Instead of using paths, we'll encode these images directly as base64 data
      try {
        const fs = require('fs');
        const path = require('path');
        
        // Define paths to our asset files
        let logoFileName;
        if (organization.id === 5 || organization.name.includes('Fresh Connect')) {
          logoFileName = 'organization_logo.jpeg';
          console.log(`[Booking Page Logo] Using Fresh Connect logo file: ${logoFileName}`);
        } else if (organization.id === 2 || organization.name.includes('Hanzo')) {
          logoFileName = 'hanzo_logo.jpeg';
          console.log(`[Booking Page Logo] Using Hanzo logo file: ${logoFileName}`);
        } else {
          logoFileName = 'dock_optimizer_logo.jpg';
          console.log(`[Booking Page Logo] Using default Dock Optimizer logo file: ${logoFileName}`);
        }
        
        // Read the file directly from the assets directory
        const logoPath = path.join(process.cwd(), 'client', 'src', 'assets', logoFileName);
        console.log(`[Booking Page Logo] Reading logo from path: ${logoPath}`);
        
        if (fs.existsSync(logoPath)) {
          const logoData = fs.readFileSync(logoPath, {encoding: 'base64'});
          const mimeType = logoFileName.endsWith('.jpeg') || logoFileName.endsWith('.jpg') 
            ? 'image/jpeg' 
            : 'image/png';
          fallbackLogoPath = `data:${mimeType};base64,${logoData}`;
          console.log(`[Booking Page Logo] Successfully loaded logo file with ${logoData.length} bytes`);
        } else {
          console.warn(`[Booking Page Logo] Logo file not found at ${logoPath}`);
          fallbackLogoPath = '';
        }
      } catch (err) {
        console.error(`[Booking Page Logo] Error loading logo file:`, err);
        fallbackLogoPath = '';
      }
      
      console.log(`[Booking Page Logo] Using organization-specific logo path for ${organization.name}: ${fallbackLogoPath}`);
      return res.json({ logo: fallbackLogoPath });
    } catch (error) {
      console.error('[Booking Page Logo] Error fetching logo:', error);
      return res.status(500).json({ message: 'Error fetching organization logo' });
    }
  });
}