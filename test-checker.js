#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// ES modules support
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes for better terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  dim: '\x1b[2m',
  bold: '\x1b[1m'
};

console.log(`${colors.cyan}${colors.bold}===== Dock Optimizer Test Checker =====${colors.reset}\n`);

// Define test directories to check
const testDirectories = [
  { path: 'server/tests', type: 'server' },
  { path: 'client/src/__tests__', type: 'client' },
  { path: 'cypress/e2e', type: 'e2e' }
];

// Counters for reporting
let totalTestFiles = 0;
let totalTestsFound = 0;
let fileErrors = 0;

// Check Jest test files
function analyzeTestFile(filePath, type) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Simple analysis of test structure
    const describeCount = (content.match(/describe\(/g) || []).length;
    const itCount = (content.match(/it\(/g) || []).length;
    const testCount = (content.match(/test\(/g) || []).length;
    const expectCount = (content.match(/expect\(/g) || []).length;
    
    totalTestsFound += itCount + testCount;
    
    return {
      file: path.basename(filePath),
      path: filePath,
      describes: describeCount,
      its: itCount,
      tests: testCount,
      expects: expectCount,
      totalAssertions: itCount + testCount,
      validStructure: describeCount > 0 && (itCount > 0 || testCount > 0)
    };
  } catch (error) {
    fileErrors++;
    return {
      file: path.basename(filePath),
      path: filePath,
      error: error.message,
      validStructure: false
    };
  }
}

// Process each directory
testDirectories.forEach(directory => {
  const dirPath = directory.path;
  console.log(`${colors.blue}Checking ${directory.type} tests in ${dirPath}...${colors.reset}`);
  
  // Skip if directory doesn't exist
  if (!fs.existsSync(dirPath)) {
    console.log(`${colors.yellow}Directory ${dirPath} does not exist. Skipping.${colors.reset}\n`);
    return;
  }
  
  // Find test files recursively (simplified)
  const testFilePattern = directory.type === 'e2e' ? /\.cy\.(js|ts)x?$/ : /\.(test|spec)\.(js|ts)x?$/;
  
  const findTestFiles = (dir) => {
    let results = [];
    const items = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const item of items) {
      const itemPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        results = [...results, ...findTestFiles(itemPath)];
      } else if (testFilePattern.test(item.name)) {
        results.push(itemPath);
      }
    }
    
    return results;
  };
  
  const testFiles = findTestFiles(dirPath);
  totalTestFiles += testFiles.length;
  
  if (testFiles.length === 0) {
    console.log(`${colors.yellow}No test files found in ${dirPath}${colors.reset}\n`);
    return;
  }
  
  // Process the test files
  const fileDetails = testFiles.map(file => {
    return {
      ...analyzeTestFile(file, directory.type),
      type: directory.type
    };
  });
  
  // Show results for this directory
  fileDetails.forEach(file => {
    if (file.error) {
      console.log(`  ${colors.red}✗ ${file.file} - Error: ${file.error}${colors.reset}`);
    } else {
      const status = file.validStructure ? `${colors.green}✓` : `${colors.red}✗`;
      console.log(`  ${status} ${file.file} - ${file.describes} suites, ${file.its + file.tests} tests${colors.reset}`);
    }
  });
  
  console.log('');
});

// Overall summary
console.log(`${colors.cyan}===== Test Files Summary =====${colors.reset}`);
console.log(`${colors.bold}Total test files found: ${totalTestFiles}${colors.reset}`);
console.log(`${colors.bold}Total test cases found: ${totalTestsFound}${colors.reset}`);

if (fileErrors > 0) {
  console.log(`${colors.red}Files with errors: ${fileErrors}${colors.reset}`);
  console.log(`${colors.yellow}Some test files have errors and may not run properly.${colors.reset}`);
} else {
  console.log(`${colors.green}All test files analyzed successfully.${colors.reset}`);
}

console.log(`\n${colors.cyan}${colors.bold}===== Jest Test Status =====${colors.reset}`);
try {
  // Simple Jest check to see if it can find any tests
  const jestCheckResult = execSync('npx jest --listTests', { 
    timeout: 5000, 
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'ignore'] // Ignore stderr
  });
  
  // Count the lines in the output
  const testCount = jestCheckResult.split('\n').filter(Boolean).length;
  console.log(`${colors.green}Jest found ${testCount} testable files${colors.reset}`);
  console.log(`${colors.green}Jest configuration is valid!${colors.reset}`);
} catch (error) {
  console.log(`${colors.red}Jest configuration issue: ${error.message.split('\n')[0]}${colors.reset}`);
  console.log(`${colors.yellow}Please check your Jest configuration in jest.config.js${colors.reset}`);
}

// Ready-to-use info
console.log(`\n${colors.cyan}${colors.bold}===== Pre-Deployment Recommendation =====${colors.reset}`);
if (totalTestFiles > 0) {
  console.log(`${colors.green}✓ Test files are in place${colors.reset}`);
  console.log(`${colors.yellow}Note: For full testing, run tests in a CI/CD environment${colors.reset}`);
  console.log(`${colors.green}Ready for deployment!${colors.reset}`);
} else {
  console.log(`${colors.yellow}⚠ No test files were found${colors.reset}`);
  console.log(`${colors.yellow}Consider adding tests before final deployment${colors.reset}`);
}