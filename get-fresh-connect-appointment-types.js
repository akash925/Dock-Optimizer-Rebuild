/**
 * Script to retrieve appointment types for Fresh Connect tenant
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

async function getAppointmentTypes() {
  try {
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

    // Get appointment types
    console.log('\n2. Fetching appointment types...');
    const response = await fetch(`${BASE_URL}/api/appointment-types`, {
      headers: { Cookie: cookies }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch appointment types: ${response.status} ${response.statusText}`);
    }
    
    const appointmentTypes = await response.json();
    console.log('\nFresh Connect Appointment Types:');
    
    appointmentTypes.forEach(type => {
      console.log(`ID: ${type.id}, Name: ${type.name}, Duration: ${type.duration} minutes, Allow Through Breaks: ${type.allowAppointmentsThroughBreaks ? 'Yes' : 'No'}`);
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

getAppointmentTypes();