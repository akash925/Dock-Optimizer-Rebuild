/**
 * Test script for BOL upload functionality
 * 
 * This script tests the enhanced BOL upload component and server-side
 * validation for different file types and scenarios.
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const FormData = require('form-data');

// Test files to use
const testFiles = {
  validPdf: path.join(process.cwd(), 'attached_assets', 'DB_aabhedhaiaai0x11AF.pdf'),
  validImage: path.join(process.cwd(), 'attached_assets', 'Dock_Optimizer_logo 2.jpg'),
  emptyFile: path.join(process.cwd(), 'test-empty-file.pdf'),
  invalidFile: path.join(process.cwd(), 'test-invalid-file.xyz')
};

// Create test files
function createTestFiles() {
  // Create an empty PDF file for testing validation
  fs.writeFileSync(testFiles.emptyFile, '');
  
  // Create an invalid file type
  fs.writeFileSync(testFiles.invalidFile, 'This is not a valid document file');
  
  console.log('Created test files for validation testing');
}

// Clean up test files
function cleanupTestFiles() {
  try {
    if (fs.existsSync(testFiles.emptyFile)) {
      fs.unlinkSync(testFiles.emptyFile);
    }
    if (fs.existsSync(testFiles.invalidFile)) {
      fs.unlinkSync(testFiles.invalidFile);
    }
    console.log('Cleaned up test files');
  } catch (error) {
    console.error('Error cleaning up test files:', error);
  }
}

// Test BOL upload functionality
async function testBolUpload() {
  try {
    console.log('\n=== Testing BOL Upload Functionality ===\n');
    
    // Create test files
    createTestFiles();
    
    // Login to get session cookie
    console.log('Logging in to get session...');
    const loginResponse = await fetch('http://localhost:3000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testadmin',
        password: 'password123'
      })
    });
    
    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status} ${loginResponse.statusText}`);
    }
    
    const cookies = loginResponse.headers.get('set-cookie');
    console.log('Login successful, session cookie obtained');
    
    // Test valid PDF upload
    console.log('\nTest 1: Uploading valid PDF document...');
    await testFileUpload(testFiles.validPdf, cookies, 'Valid PDF');
    
    // Test valid image upload
    console.log('\nTest 2: Uploading valid image document...');
    await testFileUpload(testFiles.validImage, cookies, 'Valid Image');
    
    // Test empty file upload (should be rejected)
    console.log('\nTest 3: Uploading empty file (should fail validation)...');
    await testFileUpload(testFiles.emptyFile, cookies, 'Empty File');
    
    // Test invalid file type upload (should be rejected)
    console.log('\nTest 4: Uploading invalid file type (should fail validation)...');
    await testFileUpload(testFiles.invalidFile, cookies, 'Invalid File Type');
    
    console.log('\n=== BOL Upload Testing Complete ===\n');
    
  } catch (error) {
    console.error('Error in BOL upload test:', error);
  } finally {
    // Clean up
    cleanupTestFiles();
  }
}

// Helper function to test file upload
async function testFileUpload(filePath, cookies, testName) {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`Test file not found: ${filePath}`);
      return;
    }
    
    // Create form data with file
    const form = new FormData();
    form.append('bolFile', fs.createReadStream(filePath));
    form.append('scheduleId', '77'); // Use an existing schedule ID for testing
    
    // Get file stats for logging
    const stats = fs.statSync(filePath);
    console.log(`- Uploading ${path.basename(filePath)} (${formatBytes(stats.size)})`);
    
    // Send upload request
    const uploadResponse = await fetch('http://localhost:3000/api/bol-upload/upload', {
      method: 'POST',
      headers: {
        Cookie: cookies
      },
      body: form
    });
    
    const responseData = await uploadResponse.json();
    
    if (uploadResponse.ok) {
      console.log(`✓ ${testName} upload successful:`);
      console.log(`  - File URL: ${responseData.fileUrl}`);
      console.log(`  - Document ID: ${responseData.documentId}`);
      if (responseData.metadata) {
        console.log(`  - Extracted metadata: ${Object.keys(responseData.metadata).join(', ')}`);
      }
    } else {
      console.log(`✗ ${testName} upload failed as expected:`);
      console.log(`  - Error: ${responseData.error}`);
      console.log(`  - Details: ${responseData.details || 'No additional details'}`);
    }
    
    return responseData;
    
  } catch (error) {
    console.error(`Error in ${testName} upload test:`, error);
  }
}

// Helper function to format bytes
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

// Run tests
testBolUpload();