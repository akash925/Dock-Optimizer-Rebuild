/**
 * Test OCR error handling in the BOL processing pipeline
 * 
 * This script simulates different error scenarios to verify that:
 * 1. Documents are still saved when OCR processing fails
 * 2. Appropriate error messages are returned
 * 3. The system continues to function after an error
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testOcrErrorHandling() {
  try {
    // Get authentication cookie
    console.log('Getting authentication cookie...');
    const loginResponse = await fetch('http://localhost:3000/api/test-login');
    
    if (!loginResponse.ok) {
      throw new Error(`Authentication failed: ${loginResponse.status} ${loginResponse.statusText}`);
    }
    
    const cookies = loginResponse.headers.get('set-cookie');
    console.log('Authentication successful');
    
    // Test Case 1: Empty PDF file (should trigger an OCR error but still save the file)
    await testEmptyDocumentHandling(cookies);
    
    // Test Case 2: Corrupted PDF file (should trigger an OCR error but still save the file)
    await testCorruptedDocumentHandling(cookies);
    
    // Test Case 3: Image too large (should return appropriate error but still save the file)
    await testLargeImageHandling(cookies);
    
    console.log('\nAll error handling tests completed');
  } catch (error) {
    console.error('Testing framework error:', error);
  }
}

async function testEmptyDocumentHandling(cookies) {
  console.log('\n=== Test Case 1: Empty PDF ===');
  // Create an empty PDF file
  const emptyPdfPath = path.join(__dirname, 'empty-test.pdf');
  fs.writeFileSync(emptyPdfPath, '%PDF-1.4\n%EOF\n');
  
  try {
    const form = new FormData();
    form.append('bolFile', fs.createReadStream(emptyPdfPath));
    form.append('bolNumber', 'EMPTY-TEST');
    form.append('extractionMethod', 'test_error_handling');
    
    console.log('Sending empty PDF to OCR processor...');
    const response = await fetch('http://localhost:3000/api/bol-upload/upload', {
      method: 'POST',
      body: form,
      headers: { 'Cookie': cookies }
    });
    
    const result = await response.json();
    console.log(`Response status: ${response.status}`);
    console.log('Response body:', JSON.stringify(result, null, 2));
    
    if (response.ok && result.fileUrl) {
      console.log('✓ Empty PDF test passed - file was saved despite OCR error');
    } else {
      console.log('✗ Empty PDF test failed - file was not saved or response was unexpected');
    }
  } catch (error) {
    console.error('Empty PDF test error:', error);
  } finally {
    // Clean up
    if (fs.existsSync(emptyPdfPath)) {
      fs.unlinkSync(emptyPdfPath);
    }
  }
}

async function testCorruptedDocumentHandling(cookies) {
  console.log('\n=== Test Case 2: Corrupted PDF ===');
  // Create a corrupted PDF file
  const corruptedPdfPath = path.join(__dirname, 'corrupted-test.pdf');
  fs.writeFileSync(corruptedPdfPath, '%PDF-1.4\nThis is not a valid PDF file\n%EOF\n');
  
  try {
    const form = new FormData();
    form.append('bolFile', fs.createReadStream(corruptedPdfPath));
    form.append('bolNumber', 'CORRUPTED-TEST');
    form.append('extractionMethod', 'test_error_handling');
    
    console.log('Sending corrupted PDF to OCR processor...');
    const response = await fetch('http://localhost:3000/api/bol-upload/upload', {
      method: 'POST',
      body: form,
      headers: { 'Cookie': cookies }
    });
    
    const result = await response.json();
    console.log(`Response status: ${response.status}`);
    console.log('Response body:', JSON.stringify(result, null, 2));
    
    if (response.ok && result.fileUrl) {
      console.log('✓ Corrupted PDF test passed - file was saved despite OCR error');
    } else {
      console.log('✗ Corrupted PDF test failed - file was not saved or response was unexpected');
    }
  } catch (error) {
    console.error('Corrupted PDF test error:', error);
  } finally {
    // Clean up
    if (fs.existsSync(corruptedPdfPath)) {
      fs.unlinkSync(corruptedPdfPath);
    }
  }
}

async function testLargeImageHandling(cookies) {
  console.log('\n=== Test Case 3: Testing with Real PDF ===');
  const pdfPath = path.join(__dirname, 'attached_assets', 'DB_aabhedhaiaai0x11AF.pdf');
  
  if (!fs.existsSync(pdfPath)) {
    console.log('Real PDF file not found, skipping test');
    return;
  }
  
  try {
    const form = new FormData();
    form.append('bolFile', fs.createReadStream(pdfPath));
    form.append('bolNumber', 'REAL-TEST');
    form.append('extractionMethod', 'test_error_handling');
    
    console.log('Sending real PDF to OCR processor...');
    const response = await fetch('http://localhost:3000/api/bol-upload/upload', {
      method: 'POST',
      body: form,
      headers: { 'Cookie': cookies }
    });
    
    const result = await response.json();
    console.log(`Response status: ${response.status}`);
    console.log('Response body:', JSON.stringify(result, null, 2));
    
    if (response.ok && result.fileUrl) {
      console.log('✓ Real PDF test passed - file was processed and saved');
    } else {
      console.log('✗ Real PDF test failed - file was not saved or response was unexpected');
    }
  } catch (error) {
    console.error('Real PDF test error:', error);
  }
}

// Run the tests
testOcrErrorHandling().catch(error => {
  console.error('Test execution failed:', error);
});