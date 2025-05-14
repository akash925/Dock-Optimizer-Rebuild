/**
 * Test script to create an appointment that spans through a break time
 * 
 * This script tests creating a 4-hour container appointment (type 17) 
 * starting at 11:00 AM which would span through the 12:00-13:00 break time
 * at Fresh Connect HQ facility.
 */

import fetch from 'node-fetch';

async function createAppointmentThroughBreak() {
  try {
    // Login as Fresh Connect Central admin
    console.log("\n1. Logging in as Fresh Connect admin...");
    const loginResponse = await fetch('http://localhost:5000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        username: 'akash@agarwalhome.com', 
        password: 'fccentral'
      })
    });

    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.statusText}`);
    }

    const cookies = loginResponse.headers.get('set-cookie');
    console.log("Login successful!\n");

    // First verify the appointment type settings
    const typeResponse = await fetch('http://localhost:5000/api/appointment-types/17', {
      headers: { Cookie: cookies }
    });
    if (!typeResponse.ok) {
      throw new Error(`Failed to fetch appointment type: ${typeResponse.statusText}`);
    }
    
    const appointmentType = await typeResponse.json();
    console.log('Appointment Type Settings:');
    console.log(`- Name: ${appointmentType.name}`);
    console.log(`- Duration: ${appointmentType.duration} minutes`);
    console.log(`- Allow Through Breaks: ${appointmentType.allow_appointments_through_breaks || appointmentType.allowAppointmentsThroughBreaks}`);
    
    // Create test appointment data
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Format date as YYYY-MM-DD
    const appointmentDate = tomorrow.toISOString().split('T')[0];
    
    // Create appointment at 11:00 AM (spans through lunch break)
    const startTime = new Date(`${appointmentDate}T11:00:00`);
    
    // Calculate end time (4 hours later)
    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 4);
    
    // Appointment data
    const appointmentData = {
      type: "inbound",
      status: "scheduled",
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      dockId: 23, // Dock at Fresh Connect HQ
      facilityId: 7, // Fresh Connect HQ
      appointmentTypeId: 17, // 4 Hour Container Appointment
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
      notes: "Test appointment spanning through lunch break"
    };
    
    console.log(`\nCreating 4-hour appointment on ${appointmentDate} at 11:00 AM`);
    console.log(`Start: ${startTime.toISOString()}`);
    console.log(`End: ${endTime.toISOString()}`);
    console.log('This appointment should span through the 12:00-13:00 lunch break');
    
    // Send the appointment creation request
    const response = await fetch('http://localhost:5000/api/schedules', {
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
    console.log('\nAppointment created successfully:');
    console.log(`- ID: ${appointment.id}`);
    console.log(`- Start: ${appointment.startTime}`);
    console.log(`- End: ${appointment.endTime}`);
    console.log(`- Status: ${appointment.status}`);
    console.log(`- Reference: ${appointment.referenceNumber}`);
    
    console.log('\nTest completed successfully!');
    
  } catch (error) {
    console.error('Error creating appointment:', error);
  }
}

createAppointmentThroughBreak().catch(console.error);