import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';

/**
 * Test script for OCR document processing
 * 
 * This script tests the OCR document processing endpoint by sending a sample image
 */
async function testOcrProcessing() {
  // Log in with test admin user to get authentication cookie
  console.log('Getting authentication cookie...');
  const loginResponse = await fetch('http://localhost:5000/api/test-login');
  
  if (!loginResponse.ok) {
    console.error('Failed to login:', await loginResponse.text());
    process.exit(1);
  }
  
  // Extract cookies from login response
  const cookies = loginResponse.headers.get('set-cookie');
  console.log('Authentication cookie obtained');
  
  // Check if we have a sample PDF in the attached_assets folder
  const samplePdfPath1 = path.join('attached_assets', 'DB_aabhedhaiaai0x11AF.pdf');
  const samplePdfPath2 = path.join('attached_assets', '20250414123526782.pdf');
  let testFilePath;
  
  if (fs.existsSync(samplePdfPath1)) {
    testFilePath = samplePdfPath1;
    console.log(`Using sample PDF: ${samplePdfPath1}`);
  } else if (fs.existsSync(samplePdfPath2)) {
    testFilePath = samplePdfPath2;
    console.log(`Using sample PDF: ${samplePdfPath2}`);
  } else {
    // No sample PDF found, create a test text image
    console.log('No sample PDF found, creating test image...');
    
    // Generate a test image with text using ImageMagick if available
    try {
      const testImagePath = path.join('uploads', 'test-ocr-image.png');
      execSync(`convert -size 800x600 -background white -fill black -font Arial -pointsize 48 -gravity center label:"Testing OCR 123" ${testImagePath}`);
      testFilePath = testImagePath;
      console.log(`Created test image at ${testImagePath}`);
    } catch (error) {
      console.error('Failed to create test image:', error);
      console.log('Using simple download image as fallback');
      
      // Download a test image as a fallback
      try {
        const testImagePath = path.join('uploads', 'test-ocr-image.png');
        execSync(`curl -o ${testImagePath} https://i.imgur.com/7uLj5b8.png`);
        testFilePath = testImagePath;
        console.log(`Downloaded test image to ${testImagePath}`);
      } catch (downloadError) {
        console.error('Failed to download test image:', downloadError);
        process.exit(1);
      }
    }
  }
  
  // Create form data
  const formData = new FormData();
  formData.append('document', fs.createReadStream(testFilePath));
  
  // Send request to OCR endpoint
  console.log('Sending test document to OCR endpoint...');
  const response = await fetch('http://localhost:5000/api/ocr/process-document', {
    method: 'POST',
    body: formData,
    headers: {
      'Cookie': cookies
    }
  });
  
  // Check response
  if (response.ok) {
    const result = await response.json();
    console.log('OCR processing successful!');
    console.log('Extracted text:');
    if (result.result && result.result.text) {
      result.result.text.forEach(text => console.log(`- ${text}`));
    } else {
      console.log('No text extracted or unexpected response format');
    }
    console.log('\nFull response:');
    console.log(JSON.stringify(result, null, 2));
    return true;
  } else {
    console.error('OCR processing failed:', await response.text());
    return false;
  }
}

// Run the test
testOcrProcessing()
  .then(success => {
    if (success) {
      console.log('OCR test completed successfully');
    } else {
      console.error('OCR test failed');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Error during OCR test:', error);
    process.exit(1);
  });

// Export functions for importing in other modules if needed
export { testOcrProcessing };