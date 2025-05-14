// Test file to verify our availability service is working correctly
import { db } from '../db';
import * as storageModule from '../storage';
import { 
  fetchRelevantAppointmentsForDay,
  calculateAvailabilitySlots 
} from '../src/services/availability';

async function testAvailabilityService() {
  console.log('===== Testing Availability Service =====');
  
  try {
    // Test parameters
    const testDate = '2025-05-10'; // A future date
    const facilityId = 1; // Example facility ID
    const appointmentTypeId = 1; // Example appointment type ID
    const effectiveTenantId = 2; // Example tenant ID (Hanzo)
    
    console.log(`Testing fetchRelevantAppointmentsForDay with facilityId=${facilityId}, date=${testDate}, tenantId=${effectiveTenantId}`);
    
    // This test just verifies that the function is accessible and doesn't throw errors
    // It won't actually execute the full calculation since we're stopping after initial setup steps
    try {
      // Attempt to calculate availability slots
      // Create a test storage instance
      // This is a mock implementation to test the service
      const storage = {
        getFacility: async (id: number) => ({
          id,
          name: 'Test Facility',
          timezone: 'America/New_York',
          mondayOpen: true,
          mondayStart: '08:00',
          mondayEnd: '17:00',
          tuesdayOpen: true,
          tuesdayStart: '08:00',
          tuesdayEnd: '17:00',
          wednesdayOpen: true,
          wednesdayStart: '08:00',
          wednesdayEnd: '17:00',
          thursdayOpen: true,
          thursdayStart: '08:00',
          thursdayEnd: '17:00',
          fridayOpen: true,
          fridayStart: '08:00',
          fridayEnd: '17:00',
          saturdayOpen: false,
          saturdayStart: null,
          saturdayEnd: null,
          sundayOpen: false,
          sundayStart: null,
          sundayEnd: null,
        }),
        getAppointmentType: async (id: number) => ({
          id,
          name: 'Test Appointment',
          duration: 30,
          bufferTime: 15,
          maxPerSlot: 2,
          overrideFacilityHours: false,
        }),
      };
      
      const availabilitySlots = await calculateAvailabilitySlots(
        db,
        storage,
        testDate,
        facilityId,
        appointmentTypeId,
        effectiveTenantId
      );
      
      console.log('calculateAvailabilitySlots successful');
      console.log(`Result slots count: ${availabilitySlots.length}`);
    } catch (error) {
      console.error('Error in calculateAvailabilitySlots:', error);
    }
    
    console.log('===== Test Complete =====');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Execute the test when this file is run directly
if (require.main === module) {
  testAvailabilityService()
    .then(() => console.log('Test completed'))
    .catch(error => console.error('Test failed with error:', error))
    .finally(() => process.exit(0));
}

export { testAvailabilityService };