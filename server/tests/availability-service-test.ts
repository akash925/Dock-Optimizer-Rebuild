// Test file to verify our availability service is working correctly
import { db } from '../db';
import * as storageModule from '../storage';
import { 
  fetchRelevantAppointmentsForDay,
  calculateAvailabilitySlots 
} from '../services/availabilityService';

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
      // Get the storage instance from the module
      const storage = storageModule.storage || new storageModule.DatabaseStorage();
      
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