/**
 * Test script to verify that availability calculation correctly handles facility break times
 * This tests two different appointment types at the same facility:
 * - One that disallows appointments through breaks (type 16)
 * - One that allows appointments through breaks (type 17)
 */
import fetch from 'node-fetch';

// Test configuration
const BASE_URL = process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.replit.dev` : 'http://localhost:3000';
const TEST_FACILITY_ID = 7; // Fresh Connect HQ
const TEST_APPOINTMENT_TYPE_ID = 16; // 1 Hour Trailer Appointment (doesn't allow through breaks)
const TEST_APPOINTMENT_TYPE_ALLOW_THROUGH_BREAKS = 17; // 4 Hour Container Appointment (allows through breaks)
const TEST_DATE = new Date().toISOString().split('T')[0]; // Today's date in YYYY-MM-DD format
const BOOKING_PAGE_SLUG = 'fresh-connect-booking'; // Slug for Fresh Connect booking page

async function runTest() {
  console.log('======================================================');
  console.log('TEST: VERIFY BREAK TIME HANDLING IN AVAILABILITY API');
  console.log('======================================================');
  console.log(`Date: ${TEST_DATE}`);
  console.log(`Facility ID: ${TEST_FACILITY_ID}`);
  
  try {
    // Test both appointment types
    await testAppointmentType(TEST_APPOINTMENT_TYPE_ID, "Regular (disallows through breaks)");
    console.log("\n\n");
    await testAppointmentType(TEST_APPOINTMENT_TYPE_ALLOW_THROUGH_BREAKS, "Container (allows through breaks)");
  } catch (error) {
    console.error('Test failed:', error);
  }
}

async function testAppointmentType(appointmentTypeId, description) {
  console.log('------------------------------------------------------');
  console.log(`TESTING APPOINTMENT TYPE: ${description} (ID: ${appointmentTypeId})`);
  console.log('------------------------------------------------------');
  
  // Test the enhanced v2 availability endpoint
  console.log('Testing enhanced v2 availability endpoint...');
  const v2Url = `${BASE_URL}/api/availability/v2?date=${TEST_DATE}&facilityId=${TEST_FACILITY_ID}&appointmentTypeId=${appointmentTypeId}&bookingPageSlug=${BOOKING_PAGE_SLUG}`;
  
  console.log(`Requesting: ${v2Url}`);
  try {
    const v2Response = await fetch(v2Url);
    
    if (!v2Response.ok) {
      console.error(`Error: ${v2Response.status} ${v2Response.statusText}`);
      const errorText = await v2Response.text();
      console.error(`Response: ${errorText}`);
      throw new Error(`API request failed with status ${v2Response.status}`);
    }
    
    const v2Data = await v2Response.json();
    console.log(`Endpoint returned ${v2Data.slots?.length || 0} total slots`);
    
    if (!v2Data.slots) {
      console.warn('Endpoint did not return detailed slot information');
      return;
    }
    
    const availableSlots = v2Data.slots.filter(s => s.available);
    const unavailableSlots = v2Data.slots.filter(s => !s.available);
    
    console.log(`Available slots: ${availableSlots.length}`);
    console.log(`Unavailable slots: ${unavailableSlots.length}`);
    
    // Check for slots marked unavailable due to break time
    const breakTimeSlots = v2Data.slots.filter(s => !s.available && s.reason?.includes('Break Time'));
    console.log(`Break time slots: ${breakTimeSlots.length}`);
    
    // Check for slots that span through break time (available despite overlapping break)
    const spansThroughBreakSlots = v2Data.slots.filter(s => s.available && s.reason?.includes('Spans through break time'));
    console.log(`Slots spanning through break time: ${spansThroughBreakSlots.length}`);
    
    // Check slots during break time window (12:00-13:00)
    const breakTimeWindow = v2Data.slots.filter(s => {
      const hourMin = s.time.split(':');
      const hour = parseInt(hourMin[0], 10);
      return hour === 12; // 12:00-12:59
    });
    
    console.log(`Total slots during break time window (12:00-12:59): ${breakTimeWindow.length}`);
    console.log(`Available during break window: ${breakTimeWindow.filter(s => s.available).length}`);
    console.log(`Unavailable during break window: ${breakTimeWindow.filter(s => !s.available).length}`);
    
    // Display sample slots during break time
    if (breakTimeWindow.length > 0) {
      console.log('\nSample slots during break time window (12:00-12:59):');
      breakTimeWindow.slice(0, 5).forEach((slot, index) => {
        console.log(`  ${index + 1}. ${slot.time}: ${slot.available ? 'AVAILABLE' : 'UNAVAILABLE'} - ${slot.reason || 'No reason'}`);
      });
    }
    
    // Display sample break time slots
    if (breakTimeSlots.length > 0) {
      console.log('\nSample break time slots:');
      breakTimeSlots.slice(0, 3).forEach((slot, index) => {
        console.log(`  ${index + 1}. ${slot.time}: ${slot.reason}`);
      });
    }
    
    // Display sample slots spanning through break time
    if (spansThroughBreakSlots.length > 0) {
      console.log('\nSample slots spanning through break time:');
      spansThroughBreakSlots.slice(0, 3).forEach((slot, index) => {
        console.log(`  ${index + 1}. ${slot.time}: ${slot.reason}`);
      });
    }
    
    // Validation
    if (appointmentTypeId === TEST_APPOINTMENT_TYPE_ID) {
      // Type that disallows through breaks
      if (breakTimeSlots.length > 0) {
        console.log('\n✅ PASS: Found slots marked as unavailable due to break time');
      } else {
        console.log('\n❌ FAIL: Expected to find slots marked as unavailable due to break time');
      }
      
      if (spansThroughBreakSlots.length === 0) {
        console.log('✅ PASS: No slots spanning through break time for appointment type that disallows it');
      } else {
        console.log('❌ FAIL: Found slots spanning through break time for appointment type that disallows it');
      }
    } else if (appointmentTypeId === TEST_APPOINTMENT_TYPE_ALLOW_THROUGH_BREAKS) {
      // Type that allows through breaks
      if (spansThroughBreakSlots.length > 0) {
        console.log('\n✅ PASS: Found slots that span through break time for appointment type that allows it');
      } else {
        console.log('\n❌ FAIL: Expected to find slots that span through break time for appointment type that allows it');
      }
    }
  } catch (error) {
    console.error(`Error testing appointment type ${appointmentTypeId}:`, error);
  }
}

// Run the test
runTest();