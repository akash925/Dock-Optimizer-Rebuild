/**
 * Direct OCR error handling test
 * This script uses the server's actual OCR service directly for testing
 */

// Import required modules
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure test parameters
const TEST_FILES = [
  {
    name: 'Valid PDF',
    path: path.join(__dirname, 'attached_assets', 'DB_aabhedhaiaai0x11AF.pdf'),
    expectedResult: 'success'
  },
  {
    name: 'Empty PDF',
    path: path.join(__dirname, 'empty-test.pdf'),
    expectedResult: 'error' 
  },
  {
    name: 'Corrupted PDF',
    path: path.join(__dirname, 'corrupted-test.pdf'),
    expectedResult: 'error'
  }
];

// Create test files
function createTestFiles() {
  console.log('Creating test files...');
  
  // Create empty PDF file
  fs.writeFileSync(
    path.join(__dirname, 'empty-test.pdf'),
    '%PDF-1.4\n%EOF\n'
  );
  
  // Create corrupted PDF file
  fs.writeFileSync(
    path.join(__dirname, 'corrupted-test.pdf'),
    '%PDF-1.4\nThis is not a valid PDF file\n%EOF\n'
  );
  
  console.log('Test files created successfully');
}

// Clean up test files
function cleanupTestFiles() {
  console.log('Cleaning up test files...');
  
  const filesToDelete = [
    path.join(__dirname, 'empty-test.pdf'),
    path.join(__dirname, 'corrupted-test.pdf')
  ];
  
  filesToDelete.forEach(file => {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      console.log(`Deleted: ${file}`);
    }
  });
}

// Test direct OCR service
async function testDirectOcr() {
  try {
    // Create test files
    createTestFiles();
    
    // Verify each test file
    for (const testFile of TEST_FILES) {
      console.log(`\n=== Testing OCR with: ${testFile.name} ===`);
      
      if (!fs.existsSync(testFile.path)) {
        console.log(`File not found: ${testFile.path}, skipping...`);
        continue;
      }
      
      // Run OCR test on the file
      try {
        console.log(`Processing file: ${testFile.path}`);
        const command = `node test-ocr.js "${testFile.path}"`;
        const output = execSync(command, { encoding: 'utf8' });
        console.log('Test result:');
        console.log(output.split('\n').slice(0, 10).join('\n') + '\n...');
        
        if (output.includes('successfully')) {
          console.log(`✓ Test passed for ${testFile.name}`);
          if (testFile.expectedResult === 'error') {
            console.log(`⚠️ Warning: Expected error but got success for ${testFile.name}`);
          }
        } else {
          console.log(`✗ Test failed for ${testFile.name}`);
          if (testFile.expectedResult === 'success') {
            console.log(`⚠️ Warning: Expected success but got error for ${testFile.name}`);
          }
        }
      } catch (error) {
        console.log(`Error running OCR on ${testFile.name}:`);
        console.log(error.message.split('\n').slice(0, 10).join('\n'));
        
        if (testFile.expectedResult === 'error') {
          console.log(`✓ Expected error occurred for ${testFile.name}`);
        } else {
          console.log(`✗ Unexpected error for ${testFile.name}`);
        }
      }
    }
  } catch (mainError) {
    console.error('Main test error:', mainError);
  } finally {
    // Clean up
    cleanupTestFiles();
  }
}

// Run the test
console.log('=== OCR Error Handling Test ===');
testDirectOcr().then(() => {
  console.log('\nAll tests completed');
});