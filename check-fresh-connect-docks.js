/**
 * Script to check docks at Fresh Connect HQ
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

async function checkDocks() {
  try {
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

    // Get facility info
    console.log('\n2. Getting facility info...');
    const facilityResponse = await fetch(`${BASE_URL}/api/facilities/${7}`, {
      headers: { Cookie: cookies }
    });
    
    if (!facilityResponse.ok) {
      throw new Error(`Failed to get facility: ${facilityResponse.status} ${facilityResponse.statusText}`);
    }
    
    const facility = await facilityResponse.json();
    console.log(`Facility: ${facility.name} (ID: ${facility.id})`);
    console.log(`Organization ID: ${facility.organizationId}`);
    
    // Get docks
    console.log('\n3. Getting docks for facility...');
    const docksResponse = await fetch(`${BASE_URL}/api/facilities/${7}/docks`, {
      headers: { Cookie: cookies }
    });
    
    if (!docksResponse.ok) {
      throw new Error(`Failed to get docks: ${docksResponse.status} ${docksResponse.statusText}`);
    }
    
    const docks = await docksResponse.json();
    console.log(`Found ${docks.length} docks for facility ID ${7}:`);
    docks.forEach(dock => {
      console.log(`- Dock ID: ${dock.id}, Name: ${dock.name}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkDocks();