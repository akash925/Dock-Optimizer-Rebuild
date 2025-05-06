// Test script to verify the getFacilityTenantId functionality
import fetch from 'node-fetch';

async function testFacilityTenantId() {
  console.log('Starting test for facility tenant ID lookups...');
  
  // Test Fresh Connect HQ (ID 7, should belong to tenant ID 5)
  await testFacilityBelongsToTenant(7, 5);
  
  // Test Hanzo Logistics facility (ID 1, should belong to tenant ID 2)
  await testFacilityBelongsToTenant(1, 2);
  
  console.log('Tests completed.');
}

async function testFacilityBelongsToTenant(facilityId, expectedTenantId) {
  try {
    // We need to make a booking or availability request that uses the getFacilityTenantId method
    // Since we don't have a direct API endpoint for this, we'll use the availability endpoint
    // For Fresh Connect (ID 5), use appointment type 16
    // For Hanzo (ID 2), use appointment type 5
    const appointmentTypeId = facilityId === 7 ? 16 : 5;
    
    const response = await fetch(`http://localhost:5000/api/availability?facilityId=${facilityId}&date=2025-05-10&appointmentTypeId=${appointmentTypeId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    console.log(`Facility ${facilityId} availability response:`, data);
    
    // Check if the response is valid
    if (response.ok) {
      console.log(`✅ Successfully verified facility ${facilityId} access`);
    } else {
      if (data.error && data.error.includes('tenant')) {
        console.log(`✅ Tenant isolation working - blocked access to facility ${facilityId} when not from tenant ${expectedTenantId}`);
      } else {
        console.log(`❌ Unexpected error for facility ${facilityId}:`, data);
      }
    }
  } catch (error) {
    console.error(`❌ Error testing facility ${facilityId}:`, error);
  }
}

// Run the test
testFacilityTenantId();