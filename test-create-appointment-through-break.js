/**
 * Test script to create an appointment that spans through a break time
 * 
 * This script tests creating a 4-hour container appointment (type 17) 
 * starting at 07:00 AM which would span through the facility break time (07:30-09:00)
 * at Fresh Connect HQ facility.
 * 
 * Note: Fresh Connect HQ facility has ID 7 and the 4-hour container appointment
 * type (ID 17) has 'allowAppointmentsThroughBreaks' set to true, which means
 * it allows appointments to span through break times.
 */

import fetch from 'node-fetch';
const BASE_URL = 'http://localhost:5000';

// Test parameters
const FRESH_CONNECT_HQ_ID = 7;  // ID of Fresh Connect HQ facility
const APPOINTMENT_TYPE_CONTAINER = 17; // ID of 4-hour container appointment that allows through breaks

async function createAppointmentThroughBreak() {
  try {
    console.log('======================================================');
    console.log('TEST: CREATE APPOINTMENT SPANNING THROUGH BREAK TIME');
    console.log('======================================================');
    
    // Login as Fresh Connect admin user first
    console.log('1. Logging in as Fresh Connect admin...');
    
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
      throw new Error(`Login failed: ${loginResponse.status} ${loginResponse.statusText}`);
    }
    
    const cookies = loginResponse.headers.get('set-cookie');
    console.log('Login successful');

    // First verify the appointment type settings
    console.log('\n2. Verifying appointment type settings...');
    const typeResponse = await fetch(`${BASE_URL}/api/appointment-types/${APPOINTMENT_TYPE_CONTAINER}`, {
      headers: { Cookie: cookies }
    });
    
    if (!typeResponse.ok) {
      throw new Error(`Failed to fetch appointment type: ${typeResponse.status} ${typeResponse.statusText}`);
    }
    
    const appointmentType = await typeResponse.json();
    console.log('Appointment Type Settings:');
    console.log(`- Name: ${appointmentType.name}`);
    console.log(`- Duration: ${appointmentType.duration} minutes`);
    console.log(`- Allow Through Breaks: ${appointmentType.allowAppointmentsThroughBreaks ? 'Yes' : 'No'}`);
    
    // Create test appointment data
    console.log('\n3. Creating appointment data that spans through break time...');
    const today = new Date();
    const testDate = new Date(today);
    testDate.setDate(testDate.getDate() + 1);
    
    // Format date as YYYY-MM-DD
    const appointmentDate = testDate.toISOString().split('T')[0];
    
    // Create appointment at 07:00 AM (spans through 07:30-09:00 break)
    const startTime = new Date(`${appointmentDate}T07:00:00`);
    
    // Calculate end time (4 hours later)
    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 4);
    
    // Appointment data
    const appointmentData = {
      type: "inbound",
      status: "scheduled",
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      dockId: 11, // Dock at Fresh Connect HQ
      facilityId: FRESH_CONNECT_HQ_ID, // Fresh Connect HQ
      appointmentTypeId: APPOINTMENT_TYPE_CONTAINER, // 4 Hour Container Appointment
      driver: {
        name: "Test Driver",
        phone: "555-123-4567",
        email: "test@example.com"
      },
      carrier: {
        name: "Test Carrier",
        mcNumber: "MC123456"
      },
      trailer: {
        number: "TEST-1234"
      },
      hasTrailer: true,
      referenceNumber: `TEST-BREAK-${Date.now()}`,
      creator: {
        email: "test@example.com",
        name: "Test Creator"
      },
      notes: "Test appointment spanning through break time"
    };
    
    console.log(`Creating 4-hour appointment on ${appointmentDate} at 07:00 AM`);
    console.log(`Start: ${startTime.toISOString()}`);
    console.log(`End: ${endTime.toISOString()}`);
    console.log('This appointment should span through the 07:30-09:00 break time');
    
    // Send the appointment creation request
    console.log('\n4. Submitting appointment creation request...');
    const response = await fetch(`${BASE_URL}/api/schedules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies
      },
      body: JSON.stringify(appointmentData)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create appointment: ${response.status} ${response.statusText}\n${errorText}`);
    }
    
    const appointment = await response.json();
    console.log('\n5. Appointment created successfully:');
    console.log(`- ID: ${appointment.id}`);
    console.log(`- Start: ${appointment.startTime}`);
    console.log(`- End: ${appointment.endTime}`);
    console.log(`- Status: ${appointment.status}`);
    console.log(`- Reference: ${appointment.referenceNumber}`);
    
    // Verify appointment details
    console.log('\n6. Verifying created appointment details...');
    
    const getResponse = await fetch(`${BASE_URL}/api/schedules/${appointment.id}`, {
      headers: { Cookie: cookies }
    });
    
    if (!getResponse.ok) {
      throw new Error(`Failed to fetch created appointment: ${getResponse.status} ${getResponse.statusText}`);
    }
    
    const fetchedAppointment = await getResponse.json();
    console.log('Appointment details retrieved successfully:');
    console.log(`- Type: ${fetchedAppointment.type}`);
    console.log(`- Start Time: ${new Date(fetchedAppointment.startTime).toLocaleString()}`);
    console.log(`- End Time: ${new Date(fetchedAppointment.endTime).toLocaleString()}`);
    console.log(`- Facility ID: ${fetchedAppointment.facilityId}`);
    console.log(`- Appointment Type ID: ${fetchedAppointment.appointmentTypeId}`);
    
    // Validate the appointment spans through break time
    console.log('\n7. Validating break time handling:');
    const fetchedStartTime = new Date(fetchedAppointment.startTime);
    const fetchedEndTime = new Date(fetchedAppointment.endTime);
    
    // Convert times to local time for easier comparison
    const localStartTime = fetchedStartTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const localEndTime = fetchedEndTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Check that the appointment spans through the break time (07:30-09:00)
    if (fetchedStartTime.getHours() <= 7 && fetchedEndTime.getHours() >= 9) {
      console.log('✅ Success! Appointment correctly spans through the facility break time:');
      console.log(`- Appointment time: ${localStartTime} to ${localEndTime}`);
      console.log('- Break time: 07:30 to 09:00');
      console.log('- The appointment type allows appointments through breaks and was successfully created');
    } else {
      console.log('❌ ERROR: Appointment does not span through break time as expected');
      throw new Error('Appointment does not properly span through break time');
    }
    
    console.log('\n======================================================');
    console.log('TEST SUCCESSFUL: Appointment created through break time');
    console.log('======================================================');
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:');
    console.error(error);
    process.exit(1);
  }
}

createAppointmentThroughBreak();