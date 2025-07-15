import { db } from './server/db.js';
import { bookingPages } from './shared/schema.js';

async function createBookingPage() {
  try {
    console.log('Creating test booking page...');
    
    const [bookingPage] = await db.insert(bookingPages).values({
      name: 'Test Booking Page',
      slug: 'test-booking-page',
      description: 'Test booking page for external bookings',
      facilities: [5],
      tenantId: 2,
      isActive: true,
      primaryColor: '#4CAF50',
      useOrganizationLogo: true,
      welcomeMessage: 'Welcome to our booking system',
      confirmationMessage: 'Your booking has been confirmed',
      createdBy: 1,
      lastModifiedBy: 1
    }).returning();
    
    console.log('✅ Created booking page:', bookingPage);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating booking page:', error);
    process.exit(1);
  }
}

createBookingPage();
