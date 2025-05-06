/**
 * Test script to verify that availability calculation correctly handles facility break times
 */
import fetch from 'node-fetch';

// Test configuration
const BASE_URL = process.env.BASE_URL || 'https://' + process.env.REPL_SLUG + '.replit.dev';
const TEST_FACILITY_ID = 7; // Fresh Connect HQ
const TEST_APPOINTMENT_TYPE_ID = 4; // Any appointment type for the facility
const TEST_DATE = new Date().toISOString().split('T')[0]; // Today's date in YYYY-MM-DD format
const BOOKING_PAGE_SLUG = 'fresh-connect-booking'; // Slug for Fresh Connect booking page

async function runTest() {
  console.log('======================================================');
  console.log('TEST: VERIFY BREAK TIME HANDLING IN AVAILABILITY API');
  console.log('======================================================');
  console.log(`Date: ${TEST_DATE}`);
  console.log(`Facility ID: ${TEST_FACILITY_ID}`);
  console.log(`Appointment Type ID: ${TEST_APPOINTMENT_TYPE_ID}`);
  console.log(`Booking Page Slug: ${BOOKING_PAGE_SLUG}`);
  console.log('------------------------------------------------------');
  
  try {
    // First, check the classic availability endpoint
    console.log('1. Testing classic availability endpoint...');
    const classicUrl = `${BASE_URL}/api/availability?date=${TEST_DATE}&facilityId=${TEST_FACILITY_ID}&appointmentTypeId=${TEST_APPOINTMENT_TYPE_ID}&bookingPageSlug=${BOOKING_PAGE_SLUG}`;
    
    console.log(`Requesting: ${classicUrl}`);
    const classicResponse = await fetch(classicUrl);
    
    if (!classicResponse.ok) {
      console.error(`Error: ${classicResponse.status} ${classicResponse.statusText}`);
      const errorText = await classicResponse.text();
      console.error(`Response: ${errorText}`);
      throw new Error(`API request failed with status ${classicResponse.status}`);
    }
    
    const classicData = await classicResponse.json();
    console.log(`Classic endpoint returned ${classicData.availableTimes?.length || 0} available times`);
    
    if (!classicData.slots) {
      console.warn('Classic endpoint did not return detailed slot information');
    } else {
      console.log(`Classic endpoint returned ${classicData.slots.length} total slots`);
      console.log(`Available slots: ${classicData.slots.filter(s => s.available).length}`);
      console.log(`Unavailable slots: ${classicData.slots.filter(s => !s.available).length}`);
      
      // Check for slots marked unavailable due to break time
      const breakTimeSlots = classicData.slots.filter(s => !s.available && s.reason?.includes('Break Time'));
      console.log(`Break time slots: ${breakTimeSlots.length}`);
      
      if (breakTimeSlots.length > 0) {
        console.log('Found break time slots in classic endpoint! Break time handling is working!');
        console.log('Sample break time slots:');
        breakTimeSlots.slice(0, 3).forEach(slot => {
          console.log(`  - ${slot.time}: ${slot.reason}`);
        });
      } else {
        console.log('No slots marked as break time in classic endpoint.');
      }
    }
    
    console.log('------------------------------------------------------');
    
    // Next, check the enhanced v2 availability endpoint
    console.log('2. Testing enhanced v2 availability endpoint...');
    const v2Url = `${BASE_URL}/api/availability/v2?date=${TEST_DATE}&facilityId=${TEST_FACILITY_ID}&appointmentTypeId=${TEST_APPOINTMENT_TYPE_ID}&bookingPageSlug=${BOOKING_PAGE_SLUG}`;
    
    console.log(`Requesting: ${v2Url}`);
    const v2Response = await fetch(v2Url);
    
    if (!v2Response.ok) {
      console.error(`Error: ${v2Response.status} ${v2Response.statusText}`);
      const errorText = await v2Response.text();
      console.error(`Response: ${errorText}`);
      throw new Error(`API request failed with status ${v2Response.status}`);
    }
    
    const v2Data = await v2Response.json();
    console.log(`V2 endpoint returned ${v2Data.availableTimes?.length || 0} available times`);
    console.log(`V2 endpoint returned ${v2Data.slots?.length || 0} total slots`);
    
    if (v2Data.slots) {
      console.log(`Available slots: ${v2Data.slots.filter(s => s.available).length}`);
      console.log(`Unavailable slots: ${v2Data.slots.filter(s => !s.available).length}`);
      
      // Check for slots marked unavailable due to break time
      const breakTimeSlots = v2Data.slots.filter(s => !s.available && s.reason?.includes('Break Time'));
      console.log(`Break time slots: ${breakTimeSlots.length}`);
      
      if (breakTimeSlots.length > 0) {
        console.log('Found break time slots in v2 endpoint! Break time handling is working!');
        console.log('Sample break time slots:');
        breakTimeSlots.slice(0, 3).forEach(slot => {
          console.log(`  - ${slot.time}: ${slot.reason}`);
        });
      } else {
        console.log('No slots marked as break time in v2 endpoint.');
      }
    }
    
    console.log('------------------------------------------------------');
    console.log('Test complete!');
    
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

// Run the test
runTest();