/**
 * Script to retrieve facilities for Fresh Connect tenant
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

async function getFacilities() {
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

    // Get facilities
    console.log('\n2. Fetching facilities...');
    const response = await fetch(`${BASE_URL}/api/facilities`, {
      headers: { Cookie: cookies }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch facilities: ${response.status} ${response.statusText}`);
    }
    
    const facilities = await response.json();
    console.log('\nFresh Connect Facilities:');
    
    facilities.forEach(facility => {
      console.log(`ID: ${facility.id}, Name: ${facility.name}`);
      
      // Get docks for this facility
      console.log(`  Docks:`);
      if (facility.docks && facility.docks.length > 0) {
        facility.docks.forEach(dock => {
          console.log(`  - ID: ${dock.id}, Name: ${dock.name}`);
        });
      } else {
        console.log('  - No docks found');
      }
    });

    // Also get facility break times for Fresh Connect HQ
    console.log('\n3. Checking break times for facility ID 7 (Fresh Connect HQ)...');
    const breakResponse = await fetch(`${BASE_URL}/api/facilities/7/breaks`, {
      headers: { Cookie: cookies }
    });
    
    if (!breakResponse.ok) {
      console.log(`  No break times found or error: ${breakResponse.status}`);
    } else {
      const breakTimes = await breakResponse.json();
      console.log('  Break times:');
      breakTimes.forEach(breakTime => {
        console.log(`  - Day: ${breakTime.dayOfWeek}, Start: ${breakTime.startTime}, End: ${breakTime.endTime}`);
      });
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

getFacilities();