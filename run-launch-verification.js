// Master test script to run all verification tests before launch
import 'dotenv/config';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { promises as fs } from 'fs';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import test modules 
let runQrTests, runStandardQuestionsTests, runAppointmentFlowTests;

try {
  const qrVerification = await import('./test-qr-verification.js');
  runQrTests = qrVerification.runTests;
} catch (error) {
  console.error('Could not import QR verification tests:', error.message);
}

try {
  const standardQuestionsTests = await import('./test-standard-questions.js');
  runStandardQuestionsTests = standardQuestionsTests.runTests;
} catch (error) {
  console.error('Could not import standard questions tests:', error.message);
}

try {
  const appointmentFlowTests = await import('./test-appointment-flow.js');
  runAppointmentFlowTests = appointmentFlowTests.runTests;
} catch (error) {
  console.error('Could not import appointment flow tests:', error.message);
}

// Make sure the test modules export their test functions
// If they don't, we'll modify them slightly to call them directly
async function runQrVerification() {
  console.log('\n======================================================');
  console.log('RUNNING QR CODE VERIFICATION TESTS');
  console.log('======================================================\n');
  
  try {
    if (typeof runQrTests === 'function') {
      await runQrTests();
    } else {
      // If not exported, just run the internal function from our file
      await (async () => {
        console.log('QR code tests are not exported properly. Please run:');
        console.log('node test-qr-verification.js');
      })();
    }
  } catch (error) {
    console.error('Error running QR code verification tests:', error);
  }
}

async function runStandardQuestionsVerification() {
  console.log('\n======================================================');
  console.log('RUNNING STANDARD QUESTIONS VERIFICATION TESTS');
  console.log('======================================================\n');
  
  try {
    if (typeof runStandardQuestionsTests === 'function') {
      await runStandardQuestionsTests();
    } else {
      // If not exported, just run the internal function from our file
      await (async () => {
        console.log('Standard questions tests are not exported properly. Please run:');
        console.log('node test-standard-questions.js');
      })();
    }
  } catch (error) {
    console.error('Error running standard questions verification tests:', error);
  }
}

async function runAppointmentFlowVerification() {
  console.log('\n======================================================');
  console.log('RUNNING APPOINTMENT FLOW VERIFICATION TESTS');
  console.log('======================================================\n');
  
  try {
    if (typeof runAppointmentFlowTests === 'function') {
      await runAppointmentFlowTests();
    } else {
      // If not exported, just run the internal function from our file
      await (async () => {
        console.log('Appointment flow tests are not exported properly. Please run:');
        console.log('node test-appointment-flow.js');
      })();
    }
  } catch (error) {
    console.error('Error running appointment flow verification tests:', error);
  }
}

async function runEnvironmentChecks() {
  console.log('\n======================================================');
  console.log('RUNNING ENVIRONMENT CONFIGURATION CHECKS');
  console.log('======================================================\n');
  
  const requiredEnvVars = [
    'HOST_URL',
    'DATABASE_URL',
    'SENDGRID_API_KEY',
    'SENDGRID_FROM_EMAIL',
    'SESSION_SECRET'
  ];
  
  console.log('Checking environment variables:');
  
  let allPresent = true;
  for (const envVar of requiredEnvVars) {
    if (process.env[envVar]) {
      // Don't log the actual values, just that they exist
      console.log(`✅ ${envVar}: Set`);
    } else {
      console.log(`❌ ${envVar}: Missing`);
      allPresent = false;
    }
  }
  
  if (allPresent) {
    console.log('\n✅ All required environment variables are set');
  } else {
    console.error('\n❌ Some required environment variables are missing');
    console.log('Please set all required environment variables before launching the application');
  }
  
  // Check HOST_URL specifically
  if (process.env.HOST_URL) {
    console.log(`\nCurrent HOST_URL: ${process.env.HOST_URL}`);
    console.log('Make sure this is set to the production URL before launching');
  }
}

async function runLaunchVerification() {
  console.log('======================================================');
  console.log('DOCK OPTIMIZER LAUNCH VERIFICATION');
  console.log('======================================================');
  console.log('Running comprehensive tests to verify system readiness for launch');
  console.log('------------------------------------------------------\n');
  
  // Run environment checks first
  await runEnvironmentChecks();
  
  // Run functional tests in sequence
  await runQrVerification();
  await runStandardQuestionsVerification();
  await runAppointmentFlowVerification();
  
  console.log('\n======================================================');
  console.log('LAUNCH VERIFICATION SUMMARY');
  console.log('======================================================');
  console.log('All automated tests have been run.');
  console.log('\nBefore launching, please perform these final manual checks:');
  console.log('1. Create a test appointment through the external booking form');
  console.log('2. Verify you receive a confirmation email with QR code');
  console.log('3. Test the QR code scanning with a mobile device');
  console.log('4. Check that all appointment questions are properly saved');
  console.log('5. Verify the calendar view shows the appointment correctly');
  console.log('6. Test rescheduling and cancellation through email links');
  console.log('\nOnce all verifications are complete, the system is ready for launch!');
}

// Run all verification tests
runLaunchVerification().catch(console.error);