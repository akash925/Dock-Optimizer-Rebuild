// Test script for QR code in emails
import { sendConfirmationEmail } from './server/notifications.js';
import fs from 'fs';

// Sample schedule for testing
const testSchedule = {
  id: 9999,
  facilityId: 1,
  dockId: 2,
  carrierId: 1,
  appointmentTypeId: 3,
  truckNumber: 'TESTTRK123',
  trailerNumber: 'TESTTR456',
  driverName: 'Test Driver',
  driverPhone: '555-123-4567',
  driverEmail: 'test@example.com',
  customerName: 'Test Customer',
  carrierName: 'Test Carrier',
  mcNumber: 'MC12345',
  bolNumber: 'BOL789',
  poNumber: 'PO56789',
  palletCount: '12',
  weight: '2000 lbs',
  appointmentMode: 'standard',
  startTime: new Date('2025-05-15T14:00:00Z'),
  endTime: new Date('2025-05-15T15:30:00Z'),
  actualStartTime: null,
  actualEndTime: null,
  type: 'inbound',
  status: 'scheduled',
  notes: 'This is a test appointment',
  customFormData: null,
  createdBy: 1,
  createdAt: new Date(),
  lastModifiedAt: null,
  lastModifiedBy: null,
  
  // Enhanced properties for emails
  facilityName: 'Test Facility',
  appointmentTypeName: 'Dry Goods Delivery',
  dockName: 'Dock A-01',
  timezone: 'America/New_York'
};

// Test confirmation email with QR code
async function sendTestQrEmail() {
  // Enter your email to receive the test
  const testEmail = process.argv[2];
  
  if (!testEmail) {
    console.error('Please provide your email address as a command line argument.');
    console.error('Example: node test-real-qr-email.js youremail@example.com');
    process.exit(1);
  }
  
  console.log(`Sending test email with QR code to: ${testEmail}`);
  
  try {
    const confirmationCode = 'QR-TEST-123';
    const result = await sendConfirmationEmail(
      testEmail,
      confirmationCode,
      testSchedule
    );
    
    if (result === true) {
      console.log('✅ Email sent successfully! Check your inbox.');
      console.log('The QR code should display correctly and lead to the check-in URL.');
    } else if (typeof result === 'object') {
      console.log('✅ Email content generated but not sent (likely in development mode).');
      console.log('HTML length:', result.html?.length || 0);
      console.log('Text length:', result.text?.length || 0);
      
      // Save the HTML to a file for viewing
      fs.writeFileSync('qr-test-email.html', result.html || '');
      console.log('HTML saved to qr-test-email.html for inspection.');
    } else {
      console.error('❌ Failed to send or generate email.');
    }
  } catch (error) {
    console.error('❌ Error sending test email:', error);
  }
}

// Run the test
sendTestQrEmail().catch(console.error);