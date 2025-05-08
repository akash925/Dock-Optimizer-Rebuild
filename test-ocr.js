import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';

/**
 * Test script for document processing
 * 
 * This script tests the document processing endpoint by sending a sample document (PDF or image)
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
    // No sample PDF found, check for image files
    const imageExtensions = ['.jpg', '.jpeg', '.png'];
    let foundImage = false;
    
    for (const dir of ['attached_assets', '.']) {
      if (foundImage) break;
      
      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const ext = path.extname(file).toLowerCase();
          if (imageExtensions.includes(ext)) {
            testFilePath = path.join(dir, file);
            console.log(`Using image file: ${testFilePath}`);
            foundImage = true;
            break;
          }
        }
      } catch (error) {
        console.error(`Error reading directory ${dir}:`, error);
      }
    }
    
    if (!foundImage) {
      console.error('No suitable test documents found');
      process.exit(1);
    }
  }
  
  // Create form data
  const formData = new FormData();
  formData.append('document', fs.createReadStream(testFilePath));
  
  // Send request to document processing endpoint
  console.log('Sending test document to processing endpoint...');
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
    console.log('Document processing successful!');
    
    // Print document info
    if (result.result && result.result.metadata) {
      console.log('\nDocument Information:');
      const metadata = result.result.metadata;
      console.log(`Type: ${metadata.type}`);
      console.log(`Filename: ${metadata.filename}`);
      console.log(`File size: ${formatBytes(metadata.filesize)}`);
      
      if (metadata.pages) {
        console.log(`Pages: ${metadata.pages}`);
      }
      
      if (metadata.dimensions) {
        console.log(`Dimensions: ${metadata.dimensions}`);
      }
    }
    
    // Print image info if available
    if (result.result && result.result.images && result.result.images.length > 0) {
      console.log('\nImage Information:');
      result.result.images.forEach((img, index) => {
        if (result.result.metadata.pages && result.result.metadata.pages > 1) {
          console.log(`Page ${img.page || index+1}:`);
        }
        console.log(`  Resolution: ${img.resolution}`);
        console.log(`  Format: ${img.format}`);
        console.log(`  Mode: ${img.mode}`);
      });
    }
    
    console.log('\nProcessing Time:', `${result.result.processing_time.toFixed(2)} seconds`);
    return true;
  } else {
    console.error('Document processing failed:', await response.text());
    return false;
  }
}

// Helper function to format bytes
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
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