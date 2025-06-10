/**
 * Test script for the availability API endpoint
 * This script tests the fixed availability service to ensure it works correctly
 */

async function testAvailabilityAPI() {
  console.log('🔍 Testing Availability API...\n');
  
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? 'https://dock-optimizer-rebuild-1.worf.replit.dev'
    : 'http://localhost:5000';
  
  // Test parameters
  const testCases = [
    {
      name: 'Basic Availability Test',
      params: {
        date: '2025-06-13',
        facilityId: 1,
        appointmentTypeId: 5
      }
    },
    {
      name: 'Weekend Availability Test',
      params: {
        date: '2025-06-14', // Saturday
        facilityId: 1,
        appointmentTypeId: 5
      }
    },
    {
      name: 'Different Facility Test',
      params: {
        date: '2025-06-13',
        facilityId: 2,
        appointmentTypeId: 5
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`📋 Running: ${testCase.name}`);
    console.log(`   Parameters: ${JSON.stringify(testCase.params)}`);
    
    try {
      const url = new URL('/api/availability', baseUrl);
      Object.entries(testCase.params).forEach(([key, value]) => {
        url.searchParams.append(key, value.toString());
      });
      
      console.log(`   Request URL: ${url.toString()}`);
      
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log(`   ❌ FAILED: ${response.status} ${response.statusText}`);
        console.log(`   Error: ${errorText}\n`);
        continue;
      }
      
      const data = await response.json();
      console.log(`   ✅ SUCCESS: Received ${data.length || 0} time slots`);
      
      if (data.length > 0) {
        const availableSlots = data.filter(slot => slot.available);
        const unavailableSlots = data.filter(slot => !slot.available);
        
        console.log(`   📊 Available slots: ${availableSlots.length}`);
        console.log(`   📊 Unavailable slots: ${unavailableSlots.length}`);
        
        if (availableSlots.length > 0) {
          console.log(`   🕐 First available: ${availableSlots[0].time}`);
          console.log(`   🕐 Last available: ${availableSlots[availableSlots.length - 1].time}`);
        }
        
        if (unavailableSlots.length > 0) {
          const reasons = [...new Set(unavailableSlots.map(slot => slot.reason))];
          console.log(`   📝 Unavailable reasons: ${reasons.join(', ')}`);
        }
      }
      
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }
    
    console.log(''); // Empty line for readability
  }
  
  console.log('🔍 Testing completed!\n');
}

// Additional test for database connection
async function testDatabaseConnection() {
  console.log('🗄️  Testing Database Connection...\n');
  
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? 'https://dock-optimizer-rebuild-1.worf.replit.dev'
    : 'http://localhost:5000';
  
  try {
    // Test facilities endpoint
    const facilitiesResponse = await fetch(`${baseUrl}/api/facilities`);
    if (!facilitiesResponse.ok) {
      throw new Error(`Facilities API failed: ${facilitiesResponse.status}`);
    }
    const facilities = await facilitiesResponse.json();
    console.log(`✅ Facilities loaded: ${facilities.length} facilities found`);
    
    // Test appointment types endpoint  
    const appointmentTypesResponse = await fetch(`${baseUrl}/api/appointment-types`);
    if (!appointmentTypesResponse.ok) {
      throw new Error(`Appointment Types API failed: ${appointmentTypesResponse.status}`);
    }
    const appointmentTypes = await appointmentTypesResponse.json();
    console.log(`✅ Appointment Types loaded: ${appointmentTypes.length} types found`);
    
    // Test docks endpoint
    const docksResponse = await fetch(`${baseUrl}/api/docks`);
    if (!docksResponse.ok) {
      throw new Error(`Docks API failed: ${docksResponse.status}`);
    }
    const docks = await docksResponse.json();
    console.log(`✅ Docks loaded: ${docks.length} docks found`);
    
  } catch (error) {
    console.log(`❌ Database connection test failed: ${error.message}`);
  }
  
  console.log('');
}

// Run the tests
async function main() {
  console.log('🚀 Starting Availability API Test Suite\n');
  console.log('======================================\n');
  
  await testDatabaseConnection();
  await testAvailabilityAPI();
  
  console.log('✨ All tests completed!');
}

// Handle Node.js execution
if (typeof window === 'undefined') {
  main().catch(console.error);
}

// Export for browser testing
if (typeof window !== 'undefined') {
  window.testAvailabilityAPI = main;
  console.log('Run window.testAvailabilityAPI() to test the availability API');
} 