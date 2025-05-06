/**
 * Test script to verify proper handling of facility break times and appointment configuration
 * 
 * This script tests two different appointment types with Fresh Connect HQ facility:
 * - Type 16: 1 Hour Trailer Appointment (allowAppointmentsThroughBreaks: false)
 * - Type 17: 4 Hour Container Appointment (allowAppointmentsThroughBreaks: true)
 * 
 * The facility has a break time from 12:00-13:00
 */

import fetch from 'node-fetch';

// Time slots to test for each appointment type
const timeSlots = [
  '09:00', // Regular time slot far from break
  '10:00', // Regular time slot
  '11:00', // Time slot that would run through break for 4-hour appointment (spans 11:00-15:00)
  '11:15', // Time slot that would run through break for 1-hour appointment (spans 11:15-12:15)
  '11:30', // Time slot that would run through break for 1-hour appointment (spans 11:30-12:30)
  '11:45', // Time slot that would run through break for 1-hour appointment (spans 11:45-12:45)
  '12:00', // Break time itself
  '13:00'  // Time slot right after break
];

async function testAvailabilityForTimeSlot(appointmentTypeId, timeSlot) {
  try {
    // Get availability for this appointment type
    const url = `http://localhost:5000/api/availability?date=2025-05-06&facilityId=7&appointmentTypeId=${appointmentTypeId}&bookingPageSlug=fresh-connect-booking`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    
    // Try to find the exact time slot
    const slot = data.slots.find(s => s.time === timeSlot);
    
    if (!slot) {
      // Find the closest available slot if the exact one isn't found
      console.log(`Time slot ${timeSlot} not found in response for appointment type ${appointmentTypeId}. Available slots are:`);
      
      // Log all available slots
      const availableSlots = data.slots.map(s => s.time).join(', ');
      console.log(`Available slots: ${availableSlots}`);
      
      return null;
    }
    
    return {
      time: slot.time,
      available: slot.available,
      reason: slot.reason || 'N/A',
      remainingCapacity: slot.remainingCapacity || 0
    };
  } catch (error) {
    console.error(`Error testing time slot ${timeSlot} for appointment type ${appointmentTypeId}:`, error);
    return null;
  }
}

async function runTests() {
  console.log('===== Testing Break Time Handling =====');
  console.log('Facility: Fresh Connect HQ (ID: 7)');
  console.log('Break Time: 12:00-13:00');
  console.log();
  
  // Test for appointment type 16 (allowAppointmentsThroughBreaks: false)
  console.log('TESTING: Type 16 - 1 Hour Trailer Appointment (allowAppointmentsThroughBreaks: false)');
  console.log('=========================================================================');
  
  for (const timeSlot of timeSlots) {
    const result = await testAvailabilityForTimeSlot(16, timeSlot);
    if (result) {
      console.log(`Time: ${result.time}, Available: ${result.available}, Reason: ${result.reason}`);
    }
  }
  
  console.log();
  
  // Test for appointment type 17 (allowAppointmentsThroughBreaks: true)
  console.log('TESTING: Type 17 - 4 Hour Container Appointment (allowAppointmentsThroughBreaks: true)');
  console.log('=========================================================================');
  
  for (const timeSlot of timeSlots) {
    const result = await testAvailabilityForTimeSlot(17, timeSlot);
    if (result) {
      console.log(`Time: ${result.time}, Available: ${result.available}, Reason: ${result.reason}`);
    }
  }
  
  console.log();
  console.log('===== Test Complete =====');
}

runTests().catch(console.error);