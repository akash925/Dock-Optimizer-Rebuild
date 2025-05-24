/**
 * Test the BOL upload endpoint directly
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testBolUpload() {
  try {
    // Get authentication cookie
    console.log('Getting authentication cookie...');
    const loginResponse = await fetch('http://localhost:3000/api/test-login');
    const cookies = loginResponse.headers.get('set-cookie');
    
    if (!cookies) {
      throw new Error('Failed to get authentication cookies');
    }
    
    console.log('Authentication successful');
    
    // Prepare form data with PDF file
    const form = new FormData();
    const filePath = path.join(__dirname, 'attached_assets', 'DB_aabhedhaiaai0x11AF.pdf');
    
    if (!fs.existsSync(filePath)) {
      console.error('Test file not found:', filePath);
      return;
    }
    
    const fileSize = fs.statSync(filePath).size;
    console.log(`Using test file: ${filePath} (${fileSize} bytes)`);
    
    form.append('bolFile', fs.createReadStream(filePath));
    form.append('bolNumber', 'BOL12345-TEST');
    form.append('customerName', 'Hanzo Logistics');
    form.append('carrierName', 'Test Carrier');
    form.append('extractionMethod', 'test_upload');
    form.append('extractionConfidence', '75');
    
    console.log('Uploading BOL document to server...');
    
    // Make request to BOL upload endpoint
    const uploadResponse = await fetch('http://localhost:3000/api/bol-upload/upload', {
      method: 'POST',
      body: form,
      headers: {
        'Cookie': cookies
      }
    });
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('Upload failed:', uploadResponse.status, uploadResponse.statusText);
      console.error('Error response:', errorText);
      return;
    }
    
    const result = await uploadResponse.json();
    console.log('Upload successful!');
    console.log('Response:', JSON.stringify(result, null, 2));
    
    // Test getting the document by ID if available
    if (result.id) {
      console.log(`\nAttempting to retrieve document with ID ${result.id}...`);
      
      const getDocResponse = await fetch(`http://localhost:3000/api/bol-upload/document/${result.id}`, {
        headers: {
          'Cookie': cookies
        }
      });
      
      if (getDocResponse.ok) {
        const document = await getDocResponse.json();
        console.log('Document retrieved successfully:');
        console.log(JSON.stringify(document, null, 2));
      } else {
        console.error('Failed to retrieve document:', getDocResponse.status, getDocResponse.statusText);
      }
    }
    
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

testBolUpload().catch(error => {
  console.error('Test execution failed:', error);
});