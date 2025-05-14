/**
 * Test script to verify the enhanced availability calculator and client-side hooks
 */

import fetch from 'node-fetch';
const BASE_URL = 'http://localhost:5000';

// Test parameters
const TEST_DATE = '2025-05-15'; // Thursday
const FRESH_CONNECT_HQ_ID = 7;  // Has break times from 12:00-13:00
const APPOINTMENT_TYPE_TRAILER = 16; // 1-hour trailers, disallows through breaks
const APPOINTMENT_TYPE_CONTAINER = 17; // 4-hour containers, allows through breaks

async function testAvailabilityV2Endpoint() {
  console.log('======================================================');
  console.log('TEST: VERIFY V2 AVAILABILITY WITH BREAK TIME HANDLING');
  console.log('======================================================');
  
  // Login as Fresh Connect admin user first
  console.log('1. Logging in as Fresh Connect admin...');
  
  try {
    const loginResponse = await fetch(`${BASE_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'akash@agarwalhome.com',
        password: 'fccentral'
      }),
      credentials: 'include'
    });
    
    if (!loginResponse.ok) {
      throw new Error(`Login failed with status ${loginResponse.status}`);
    }
    
    const cookies = loginResponse.headers.get('set-cookie');
    console.log('Login successful');
    
    // Test trailer appointment type (disallows through breaks)
    console.log('\n2. Testing trailer appointment type (disallows through breaks)...');
    const trailerUrl = `${BASE_URL}/api/availability/v2?date=${TEST_DATE}&facilityId=${FRESH_CONNECT_HQ_ID}&appointmentTypeId=${APPOINTMENT_TYPE_TRAILER}`;
    console.log(`Requesting: ${trailerUrl}`);
    
    const trailerResponse = await fetch(trailerUrl, {
      headers: { Cookie: cookies }
    });
    
    if (!trailerResponse.ok) {
      throw new Error(`API request failed with status ${trailerResponse.status}`);
    }
    
    const trailerData = await trailerResponse.json();
    console.log(`Retrieved ${trailerData.slots.length} slots for trailer appointment type`);
    
    // Find slots around break time (12:00-13:00)
    const breakSlots = trailerData.slots.filter(slot => {
      const hour = parseInt(slot.time.split(':')[0], 10);
      return hour >= 11 && hour <= 13;
    });
    
    console.log('\nExamining slots around break time (11:00-14:00):');
    breakSlots.forEach(slot => {
      console.log(`${slot.time} - Available: ${slot.available}, Reason: ${slot.reason || 'N/A'}`);
    });
    
    // Test container appointment type (allows through breaks)
    console.log('\n3. Testing container appointment type (allows through breaks)...');
    const containerUrl = `${BASE_URL}/api/availability/v2?date=${TEST_DATE}&facilityId=${FRESH_CONNECT_HQ_ID}&appointmentTypeId=${APPOINTMENT_TYPE_CONTAINER}`;
    console.log(`Requesting: ${containerUrl}`);
    
    const containerResponse = await fetch(containerUrl, {
      headers: { Cookie: cookies }
    });
    
    if (!containerResponse.ok) {
      throw new Error(`API request failed with status ${containerResponse.status}`);
    }
    
    const containerData = await containerResponse.json();
    console.log(`Retrieved ${containerData.slots.length} slots for container appointment type`);
    
    // Find slots around break time (12:00-13:00)
    const containerBreakSlots = containerData.slots.filter(slot => {
      const hour = parseInt(slot.time.split(':')[0], 10);
      return hour >= 11 && hour <= 13;
    });
    
    console.log('\nExamining slots around break time (11:00-14:00):');
    containerBreakSlots.forEach(slot => {
      console.log(`${slot.time} - Available: ${slot.available}, Reason: ${slot.reason || 'N/A'}, Remaining: ${slot.remaining}`);
    });
    
    console.log('\nVerifying both endpoints have consistent results...');
    console.log(`Trailer slots: ${trailerData.slots.length}, Container slots: ${containerData.slots.length}`);
    
    // Make a final validation
    validateResults(trailerData, containerData);
    
    console.log('\n✅ Test completed successfully! The availability V2 endpoint properly handles both appointment types with different break time settings.');
    
  } catch (error) {
    console.error('❌ TEST FAILED:', error);
    process.exit(1);
  }
}

function validateResults(trailerData, containerData) {
  // Check specific behavior around break times
  const trailerBreakSlots = trailerData.slots.filter(slot => {
    const hour = parseInt(slot.time.split(':')[0], 10);
    return hour === 11 && slot.time.includes(':30') || hour === 12;
  });
  
  const containerBreakSlots = containerData.slots.filter(slot => {
    const hour = parseInt(slot.time.split(':')[0], 10);
    return hour === 11 && slot.time.includes(':30') || hour === 12;
  });
  
  console.log('\nValidation results:');
  
  // Trailer slots through break time should be unavailable
  const trailerBreakBlocked = trailerBreakSlots.some(slot => 
    !slot.available && slot.reason && slot.reason.includes('break')
  );
  
  console.log(`- Trailer slots through break time blocked: ${trailerBreakBlocked ? '✅ Yes' : '❌ No'}`);
  
  // Container slots through break time should be available
  const containerBreakAllowed = containerBreakSlots.some(slot => 
    slot.available && slot.reason && slot.reason.includes('break')
  );
  
  console.log(`- Container slots allowed through break time: ${containerBreakAllowed ? '✅ Yes' : '❌ No'}`);
  
  // Both should have identical total number of slots
  console.log(`- Slot count matches: ${trailerData.slots.length === containerData.slots.length ? '✅ Yes' : '❌ No'}`);
  
  // Final validation 
  if (trailerBreakBlocked && containerBreakAllowed) {
    console.log('\n✅ Validation passed! Break time handling is working correctly for both appointment types.');
  } else {
    console.log('\n❌ Validation failed! Break time handling is not working as expected.');
    process.exit(1);
  }
}

// Run the test
testAvailabilityV2Endpoint();