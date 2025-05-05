import { sendConfirmationEmail, sendRescheduleEmail, sendReminderEmail } from './server/notifications.ts';

// Create a test schedule
const testSchedule = {
  id: 999,
  facilityId: 1,
  dockId: 2,
  carrierId: 3,
  appointmentTypeId: 17,
  truckNumber: 'TRK-123',
  trailerNumber: 'TRL-456',
  driverName: 'John Doe',
  driverPhone: '555-123-4567',
  driverEmail: 'driver@example.com',
  customerName: 'Test Customer',
  carrierName: 'Test Carrier',
  mcNumber: 'MC-789',
  bolNumber: 'BOL-123',
  poNumber: 'PO-456',
  palletCount: '10',
  weight: '1000',
  appointmentMode: 'standard',
  startTime: new Date('2025-05-05T10:00:00Z'),
  endTime: new Date('2025-05-05T11:00:00Z'),
  actualStartTime: null,
  actualEndTime: null,
  type: 'inbound',
  status: 'scheduled',
  notes: 'Test notes',
  customFormData: null,
  createdBy: 1,
  createdAt: new Date(),
  lastModifiedAt: null,
  lastModifiedBy: null,
  
  // Enhanced properties
  facilityName: 'Test Facility',
  appointmentTypeName: 'Standard Delivery',
  dockName: 'Dock A',
  timezone: 'America/New_York'
};

const testConfirmationCode = 'TEST' + Math.floor(Math.random() * 10000);
const testEmail = 'test@example.com';

async function runTests() {
  console.log('Starting email QR code SVG tests...');
  console.log('Testing confirmation email with QR code...');
  try {
    const confirmationResult = await sendConfirmationEmail(
      testEmail, 
      testConfirmationCode, 
      testSchedule
    );
    
    if (confirmationResult) {
      console.log('✅ Confirmation email with QR code generated successfully');
      const { html } = confirmationResult;
      // Check if the SVG is included in the HTML
      if (html.includes('<svg')) {
        console.log('✅ SVG QR code found in confirmation email');
      } else {
        console.log('❌ SVG QR code NOT found in confirmation email');
      }
    } else {
      console.log('❌ Failed to generate confirmation email');
    }
  } catch (error) {
    console.error('Error testing confirmation email:', error);
  }
  
  console.log('\nTesting reschedule email with QR code...');
  try {
    const rescheduleResult = await sendRescheduleEmail(
      testEmail, 
      testConfirmationCode, 
      testSchedule,
      new Date('2025-05-04T09:00:00Z'),
      new Date('2025-05-04T10:00:00Z')
    );
    
    if (rescheduleResult) {
      console.log('✅ Reschedule email with QR code generated successfully');
      const { html } = rescheduleResult;
      // Check if the SVG is included in the HTML
      if (html.includes('<svg')) {
        console.log('✅ SVG QR code found in reschedule email');
      } else {
        console.log('❌ SVG QR code NOT found in reschedule email');
      }
    } else {
      console.log('❌ Failed to generate reschedule email');
    }
  } catch (error) {
    console.error('Error testing reschedule email:', error);
  }
  
  console.log('\nTesting reminder email with QR code...');
  try {
    const reminderResult = await sendReminderEmail(
      testEmail, 
      testConfirmationCode, 
      testSchedule
    );
    
    if (reminderResult) {
      console.log('✅ Reminder email with QR code generated successfully');
      const { html } = reminderResult;
      // Check if the SVG is included in the HTML
      if (html.includes('<svg')) {
        console.log('✅ SVG QR code found in reminder email');
      } else {
        console.log('❌ SVG QR code NOT found in reminder email');
      }
    } else {
      console.log('❌ Failed to generate reminder email');
    }
  } catch (error) {
    console.error('Error testing reminder email:', error);
  }
  
  console.log('\nTests completed!');
}

// Run the tests
runTests().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});