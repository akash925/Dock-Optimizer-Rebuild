#!/usr/bin/env node

/**
 * Debug script for Asset Manager API in Replit
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const REPLIT_URL = process.env.REPLIT_URL || 'https://7ac480e5-c3a6-4b78-b256-c68d212e19fa-00-iao1i3rlgulq.worf.replit.dev';

async function testAssetManagerAPI() {
  console.log('🧪 Testing Asset Manager API endpoints...\n');

  try {
    // Test 1: Basic API health check
    console.log('1. Testing basic API health...');
    const healthResponse = await fetch(`${REPLIT_URL}/api/test`);
    console.log(`   Status: ${healthResponse.status}`);
    
    if (healthResponse.ok) {
      console.log('   ✅ Basic API is responding');
    } else {
      console.log('   ❌ Basic API health check failed');
    }

    // Test 2: Test company assets endpoint directly  
    console.log('\n2. Testing company assets endpoint...');
    const assetsResponse = await fetch(`${REPLIT_URL}/api/asset-manager/company-assets`);
    console.log(`   Status: ${assetsResponse.status}`);
    console.log(`   Headers:`, Object.fromEntries(assetsResponse.headers.entries()));

    if (assetsResponse.ok) {
      const assetsData = await assetsResponse.json();
      console.log('   ✅ Company assets endpoint responding');
      console.log(`   📋 Found ${assetsData.length} assets`);
      
      if (assetsData.length > 0) {
        console.log('   📝 Sample asset:', JSON.stringify(assetsData[0], null, 2));
      }
    } else {
      const errorText = await assetsResponse.text();
      console.log('   ❌ Company assets endpoint failed');
      console.log(`   Error: ${errorText}`);
    }

    // Test 3: Test database connection
    console.log('\n3. Testing database connection...');
    const dbResponse = await fetch(`${REPLIT_URL}/api/test/db-connection`);
    console.log(`   Status: ${dbResponse.status}`);
    
    if (dbResponse.ok) {
      const dbData = await dbResponse.json();
      console.log('   ✅ Database connection test:', dbData);
    } else {
      const dbError = await dbResponse.text();
      console.log('   ❌ Database connection failed:', dbError);
    }

    // Test 4: Test storage initialization
    console.log('\n4. Testing storage layer...');
    try {
      const storageResponse = await fetch(`${REPLIT_URL}/api/test/storage`);
      if (storageResponse.ok) {
        const storageData = await storageResponse.json();
        console.log('   ✅ Storage layer test:', storageData);
      } else {
        console.log('   ❌ Storage layer test failed');
      }
    } catch (error) {
      console.log('   ⚠️  Storage test endpoint not available (expected)');
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Run the test
testAssetManagerAPI().then(() => {
  console.log('\n🎯 Asset Manager API test completed!');
}).catch(error => {
  console.error('💥 Test script failed:', error);
}); 