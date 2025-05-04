// Email testing module
import { sendConfirmationEmail, sendReminderEmail } from './notifications.ts';

// Mock schedule data for testing
const mockSchedule = {
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

// Test the confirmation email
async function testConfirmationEmail(testEmail) {
  console.log(`Testing confirmation email to: ${testEmail}`);
  
  try {
    const result = await sendConfirmationEmail(
      testEmail,
      'TEST123',
      mockSchedule
    );
    
    console.log('Confirmation email test result:', result);
    return result;
  } catch (error) {
    console.error('Error sending confirmation email:', error);
    throw error;
  }
}

// Test the reminder email
async function testReminderEmail(testEmail, hoursUntil = 24) {
  console.log(`Testing reminder email to: ${testEmail} (${hoursUntil} hours until appointment)`);
  
  try {
    const result = await sendReminderEmail(
      testEmail,
      'TEST123',
      mockSchedule,
      hoursUntil
    );
    
    console.log('Reminder email test result:', result);
    return result;
  } catch (error) {
    console.error('Error sending reminder email:', error);
    throw error;
  }
}

export { testConfirmationEmail, testReminderEmail };