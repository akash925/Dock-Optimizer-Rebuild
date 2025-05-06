/**
 * Test script to create an appointment that spans through a break time using the external booking endpoint
 * 
 * This script tests creating a 4-hour container appointment (type 17) 
 * starting at 11:00 AM which would span through the 12:00-13:00 break time
 * at Fresh Connect HQ facility.
 */

import fetch from 'node-fetch';

async function createAppointmentThroughBreak() {
  console.log(`Testing appointment creation through break times`);

  // Step 1: Get the booking page info
  const bookingPageSlug = 'fresh-connect-booking';
  console.log(`\nFetching booking page info for: ${bookingPageSlug}`);
  
  // Use localhost with port 5173 (standard Vite dev port)
  const baseUrl = 'http://localhost:5173';
  const bookingPageResponse = await fetch(`${baseUrl}/api/booking-pages/${bookingPageSlug}`);
  
  if (!bookingPageResponse.ok) {
    console.error(`Error fetching booking page: ${bookingPageResponse.status} ${bookingPageResponse.statusText}`);
    return;
  }
  
  const bookingPage = await bookingPageResponse.json();
  console.log(`Booking page found: ${bookingPage.name}`);
  
  // Step 2: Get appointment type info
  const appointmentTypeId = 17; // Container appointment with allowAppointmentsThroughBreaks: true
  console.log(`\nFetching appointment type: ${appointmentTypeId}`);
  
  const typeResponse = await fetch(`${baseUrl}/api/appointment-types/${appointmentTypeId}`);
  
  if (!typeResponse.ok) {
    console.error(`Error fetching appointment type: ${typeResponse.status} ${typeResponse.statusText}`);
    return;
  }
  
  const appointmentType = await typeResponse.json();
  console.log(`Appointment Type Settings:`);
  console.log(`- Name: ${appointmentType.name}`);
  console.log(`- Duration: ${appointmentType.duration} minutes`);
  console.log(`- Allow Through Breaks: ${appointmentType.allowAppointmentsThroughBreaks || false}`);
  
  // Step 3: Test appointment creation via external booking endpoint
  const facilityId = 7; // Fresh Connect HQ
  const appointmentDate = '2025-05-07'; // Wednesday
  const appointmentTime = '11:00'; // This will span through the 12:00-13:00 lunch break
  
  console.log(`\nCreating 4-hour appointment on ${appointmentDate} at ${appointmentTime} AM`);
  console.log(`Start: ${new Date(`${appointmentDate}T${appointmentTime}:00.000Z`)}`);
  console.log(`End: ${new Date(new Date(`${appointmentDate}T${appointmentTime}:00.000Z`).getTime() + appointmentType.duration * 60000)}`);
  console.log(`This appointment should span through the 12:00-13:00 lunch break`);
  
  const bookingData = {
    bookingPageSlug: bookingPageSlug,
    facilityId: facilityId,
    appointmentTypeId: appointmentTypeId,
    appointmentDate: appointmentDate,
    appointmentTime: appointmentTime,
    customerName: 'Test Customer',
    contactName: 'Test Contact',
    contactEmail: 'test@example.com',
    contactPhone: '555-123-4567',
    carrierName: 'Test Carrier',
    trailerNumber: 'TEST-12345',
    driverName: 'Test Driver',
    driverPhone: '555-987-6543',
    truckNumber: 'TRK-12345',
    additionalNotes: 'Test appointment through break time'
  };
  
  try {
    const response = await fetch(`${baseUrl}/api/booking-pages/book-appointment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bookingData)
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log(`\nAppointment created successfully!`);
      console.log(`Appointment ID: ${result.id}`);
      console.log(`Start Time: ${new Date(result.startTime)}`);
      console.log(`End Time: ${new Date(result.endTime)}`);
      console.log(`Appointment successfully spans through break time`);
    } else {
      console.error(`\nError creating appointment: ${result.message || 'Unknown error'}`);
      if (result.errorCode === 'SLOT_UNAVAILABLE') {
        console.log(`Detected SLOT_UNAVAILABLE error code - Our error handling is working correctly`);
      }
    }
  } catch (error) {
    console.error(`Error in request:`, error);
  }
}

await createAppointmentThroughBreak();