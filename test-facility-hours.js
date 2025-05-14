/**
 * Test script to verify facility hours are correctly processed
 */
import fetch from 'node-fetch';
import fs from 'fs';

async function login() {
  try {
    // First try to log in
    const loginResponse = await fetch('http://localhost:5000/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'testadmin',
        password: 'password123'
      }),
      redirect: 'manual'
    });
    
    // Extract cookies from the response
    const cookies = loginResponse.headers.raw()['set-cookie'];
    if (!cookies) {
      console.error('No cookies returned from login response');
      process.exit(1);
    }
    
    // Save cookies to file
    fs.writeFileSync('cookies.txt', cookies.join(';'));
    
    const userData = await loginResponse.json();
    console.log('Logged in as:', userData.username, 'with tenant ID:', userData.tenantId);
    
    return cookies.join(';');
  } catch (error) {
    console.error('Login error:', error);
    process.exit(1);
  }
}

async function testFacilityHours(cookies) {
  try {
    console.log('Testing facility 4 hours with appointment type 16...');
    
    // Format today's date as YYYY-MM-DD
    const today = new Date();
    const date = today.toISOString().split('T')[0];
    
    const response = await fetch(`http://localhost:5000/api/availability/v2?date=2025-05-16&facilityId=4&appointmentTypeId=16&bookingBufferMinutes=60`, {
      headers: {
        'Cookie': cookies
      }
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    console.log('API Response:');
    console.log(JSON.stringify(data, null, 2));
    
    console.log('\nAnalyzing time slots:');
    if (data.slots && data.slots.length > 0) {
      // Log the first and last slots to check facility hours
      const sortedSlots = [...data.slots].sort((a, b) => {
        const timeA = a.time.split(':').map(Number);
        const timeB = b.time.split(':').map(Number);
        return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1]);
      });
      
      console.log(`First slot: ${sortedSlots[0].time} (${sortedSlots[0].available ? 'Available' : 'Unavailable'})`);
      console.log(`Last slot: ${sortedSlots[sortedSlots.length - 1].time} (${sortedSlots[sortedSlots.length - 1].available ? 'Available' : 'Unavailable'})`);
      
      // Count available slots by hour
      const hourCounts = {};
      for (const slot of sortedSlots) {
        const hour = slot.time.split(':')[0].padStart(2, '0');
        if (!hourCounts[hour]) hourCounts[hour] = { total: 0, available: 0 };
        hourCounts[hour].total++;
        if (slot.available) hourCounts[hour].available++;
      }
      
      console.log('\nSlots by hour:');
      Object.entries(hourCounts).forEach(([hour, counts]) => {
        console.log(`${hour}:00 - Total: ${counts.total}, Available: ${counts.available}`);
      });
    } else {
      console.log('No slots returned');
    }
    
    return data;
  } catch (error) {
    console.error('Error testing facility hours:', error);
    throw error;
  }
}

async function runTest() {
  try {
    // Login to get cookies
    const cookies = await login();
    
    // Test facility hours
    await testFacilityHours(cookies);
    
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Execute the test
runTest();