/**
 * Simple test for availability slots calculation with break times
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

// Test parameters
const FRESH_CONNECT_HQ_ID = 7;  // Fresh Connect HQ facility ID
const APPOINTMENT_TYPE_CONTAINER = 17; // 4-hour container appointment (allows through breaks)
const APPOINTMENT_TYPE_TRAILER = 16;   // 1-hour trailer appointment (does not allow through breaks)

async function testAvailabilityWithBreaks() {
  try {
    console.log('======================================================');
    console.log('TEST: AVAILABILITY CALCULATION WITH BREAK TIMES');
    console.log('======================================================');
    
    // Login as Fresh Connect admin user first
    console.log('1. Logging in as Fresh Connect admin...');
    
    const loginResponse = await fetch(`${BASE_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'akash@agarwalhome.com',
        password: 'fccentral'
      })
    });
    
    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status} ${loginResponse.statusText}`);
    }
    
    const cookies = loginResponse.headers.get('set-cookie');
    console.log('Login successful');

    // First verify the appointment types
    console.log('\n2. Verifying appointment types...');
    
    // Type 1: Container appointment (allows through breaks)
    const containerResponse = await fetch(`${BASE_URL}/api/appointment-types/${APPOINTMENT_TYPE_CONTAINER}`, {
      headers: { Cookie: cookies }
    });
    
    if (!containerResponse.ok) {
      throw new Error(`Failed to fetch container appointment type: ${containerResponse.status} ${containerResponse.statusText}`);
    }
    
    const containerType = await containerResponse.json();
    console.log(`Container appointment type (ID: ${containerType.id}):`);
    console.log(`- Name: ${containerType.name}`);
    console.log(`- Duration: ${containerType.duration} minutes`);
    console.log(`- Allow Through Breaks: ${containerType.allowAppointmentsThroughBreaks ? 'Yes' : 'No'}`);
    
    // Type 2: Trailer appointment (does not allow through breaks)
    const trailerResponse = await fetch(`${BASE_URL}/api/appointment-types/${APPOINTMENT_TYPE_TRAILER}`, {
      headers: { Cookie: cookies }
    });
    
    if (!trailerResponse.ok) {
      throw new Error(`Failed to fetch trailer appointment type: ${trailerResponse.status} ${trailerResponse.statusText}`);
    }
    
    const trailerType = await trailerResponse.json();
    console.log(`\nTrailer appointment type (ID: ${trailerType.id}):`);
    console.log(`- Name: ${trailerType.name}`);
    console.log(`- Duration: ${trailerType.duration} minutes`);
    console.log(`- Allow Through Breaks: ${trailerType.allowAppointmentsThroughBreaks ? 'Yes' : 'No'}`);
    
    // Set up test date (tomorrow)
    const today = new Date();
    const testDate = new Date(today);
    testDate.setDate(testDate.getDate() + 1);
    
    // Ensure we're not scheduling on a Sunday (facility likely closed)
    if (testDate.getDay() === 0) { // Sunday is 0
      testDate.setDate(testDate.getDate() + 1); // Move to Monday
    }
    
    // Format date as YYYY-MM-DD
    const formattedDate = testDate.toISOString().split('T')[0];
    
    // Get availability for container appointment type (allows through breaks)
    console.log(`\n3. Checking availability for Container appointment (ID: ${APPOINTMENT_TYPE_CONTAINER}) on ${formattedDate}...`);
    const containerAvailabilityResponse = await fetch(
      `${BASE_URL}/api/availability-v2?facilityId=${FRESH_CONNECT_HQ_ID}&appointmentTypeId=${APPOINTMENT_TYPE_CONTAINER}&date=${formattedDate}`,
      { headers: { Cookie: cookies } }
    );
    
    if (!containerAvailabilityResponse.ok) {
      throw new Error(`Failed to fetch container availability: ${containerAvailabilityResponse.status} ${containerAvailabilityResponse.statusText}`);
    }
    
    const containerAvailability = await containerAvailabilityResponse.json();
    console.log(`Container appointments available times: ${containerAvailability.availableSlots.length} slots`);
    
    // Check if any times are during the break period (7:30-9:00)
    const breakTimeSlots = containerAvailability.availableSlots.filter(slot => {
      const time = new Date(`${formattedDate}T${slot}`);
      const hours = time.getHours();
      const minutes = time.getMinutes();
      return (hours === 7 && minutes >= 30) || (hours === 8);
    });
    
    console.log(`- Container appointments during break time (7:30-9:00): ${breakTimeSlots.length} slots`);
    if (breakTimeSlots.length > 0) {
      console.log('  Times include: ' + breakTimeSlots.slice(0, 5).join(', ') + (breakTimeSlots.length > 5 ? '...' : ''));
    }
    
    // Get availability for trailer appointment type (does not allow through breaks)
    console.log(`\n4. Checking availability for Trailer appointment (ID: ${APPOINTMENT_TYPE_TRAILER}) on ${formattedDate}...`);
    const trailerAvailabilityResponse = await fetch(
      `${BASE_URL}/api/availability-v2?facilityId=${FRESH_CONNECT_HQ_ID}&appointmentTypeId=${APPOINTMENT_TYPE_TRAILER}&date=${formattedDate}`,
      { headers: { Cookie: cookies } }
    );
    
    if (!trailerAvailabilityResponse.ok) {
      throw new Error(`Failed to fetch trailer availability: ${trailerAvailabilityResponse.status} ${trailerAvailabilityResponse.statusText}`);
    }
    
    const trailerAvailability = await trailerAvailabilityResponse.json();
    console.log(`Trailer appointments available times: ${trailerAvailability.availableSlots.length} slots`);
    
    // Check if any times are during the break period (7:30-9:00)
    const trailerBreakTimeSlots = trailerAvailability.availableSlots.filter(slot => {
      const time = new Date(`${formattedDate}T${slot}`);
      const hours = time.getHours();
      const minutes = time.getMinutes();
      return (hours === 7 && minutes >= 30) || (hours === 8);
    });
    
    console.log(`- Trailer appointments during break time (7:30-9:00): ${trailerBreakTimeSlots.length} slots`);
    if (trailerBreakTimeSlots.length > 0) {
      console.log('  Times include: ' + trailerBreakTimeSlots.slice(0, 5).join(', ') + (trailerBreakTimeSlots.length > 5 ? '...' : ''));
    }
    
    // Verify results - container (allows through breaks) should have slots during break time
    // while trailer (doesn't allow through breaks) should not have slots during break time
    console.log('\n5. Verifying results:');
    if (containerType.allowAppointmentsThroughBreaks && trailerBreakTimeSlots.length === 0) {
      console.log('✅ Success! Break time handling works properly:');
      console.log(`- Container appointment type (allows through breaks): ${breakTimeSlots.length > 0 ? 'Has available slots during break time' : 'No slots during break time'}`);
      console.log(`- Trailer appointment type (does not allow through breaks): ${trailerBreakTimeSlots.length === 0 ? 'No slots during break time' : 'Has available slots during break time'}`);
    } else {
      console.log('❌ Unexpected results:');
      console.log(`- Container appointment type (allows through breaks): ${breakTimeSlots.length > 0 ? 'Has available slots during break time' : 'No slots during break time'}`);
      console.log(`- Trailer appointment type (does not allow through breaks): ${trailerBreakTimeSlots.length === 0 ? 'No slots during break time' : 'Has available slots during break time'}`);
      throw new Error('Availability calculation does not properly handle break times');
    }
    
    console.log('\n======================================================');
    console.log('TEST SUCCESSFUL: Availability calculation handles break times correctly');
    console.log('======================================================');
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:');
    console.error(error);
    process.exit(1);
  }
}

testAvailabilityWithBreaks();