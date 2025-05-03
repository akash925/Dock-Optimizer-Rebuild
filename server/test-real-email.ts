import sgMail from '@sendgrid/mail';
import { EnhancedSchedule, sendConfirmationEmail } from './notifications';

/**
 * This is a utility to test sending a real email directly through SendGrid
 * to verify the email service is working properly
 */
async function testRealEmailSending() {
  console.log('Starting real email sending test...');
  
  // Verify SendGrid API key exists
  if (!process.env.SENDGRID_API_KEY) {
    console.error('ERROR: SendGrid API key is not set. Cannot proceed with email test.');
    return false;
  }
  
  // Verify sender email exists
  if (!process.env.SENDGRID_FROM_EMAIL) {
    console.error('ERROR: SendGrid sender email is not set. Cannot proceed with email test.');
    return false;
  }
  
  console.log('SendGrid API key exists:', !!process.env.SENDGRID_API_KEY);
  console.log('SendGrid FROM email exists:', !!process.env.SENDGRID_FROM_EMAIL);
  
  // Set up the API key
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  
  try {
    // Create a test email with minimal data
    const testMsg = {
      to: 'akash@agarwalhome.com', // Use the admin email as test recipient
      from: process.env.SENDGRID_FROM_EMAIL,
      subject: 'Dock Optimizer - Test Email',
      text: 'This is a direct test email from Dock Optimizer to verify SendGrid is working properly.',
      html: '<p>This is a direct test email from Dock Optimizer to verify SendGrid is working properly.</p>'
    };
    
    console.log('Sending direct test email to:', testMsg.to);
    console.log('From:', testMsg.from);
    
    // Attempt to send the email directly
    const response = await sgMail.send(testMsg);
    console.log('Direct email sent successfully. Response:', response);
    
    // Now test the confirmation email function
    console.log('\nTesting confirmation email with the email functions...');
    const testSchedule: EnhancedSchedule = {
      id: 999, // Test ID
      facilityId: 1,
      dockId: 1,
      carrierId: 1,
      appointmentTypeId: 1,
      truckNumber: 'TEST-TRUCK',
      trailerNumber: 'TEST-TRAILER',
      driverName: 'Test Driver',
      driverPhone: '555-123-4567',
      driverEmail: 'test@example.com',
      customerName: 'Test Customer',
      carrierName: 'Test Carrier',
      mcNumber: 'MC-TEST',
      bolNumber: 'BOL-TEST',
      poNumber: 'PO-TEST',
      palletCount: '10',
      weight: '1000',
      appointmentMode: 'trailer',
      startTime: new Date(Date.now() + 86400000), // Tomorrow
      endTime: new Date(Date.now() + 90000000), // Tomorrow + 1 hour
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
      
      // Enhanced properties
      facilityName: 'Test Facility',
      appointmentTypeName: 'Test Appointment Type',
      dockName: 'Test Dock',
      timezone: 'America/New_York'
    };
    
    const confirmationCode = `TEST${testSchedule.id}`;
    const result = await sendConfirmationEmail(
      'akash@agarwalhome.com', // Send to admin email
      confirmationCode,
      testSchedule
    );
    
    if (result === true) {
      console.log('Confirmation email sent successfully!');
      return true;
    } else if (typeof result === 'object') {
      console.log('Generated email content but did not send it.');
      console.log('HTML length:', result.html?.length || 0);
      return false;
    } else {
      console.error('Failed to send confirmation email.');
      return false;
    }
  } catch (error) {
    console.error('Error in email test:', error);
    return false;
  }
}

// Execute the test
testRealEmailSending()
  .then(success => {
    console.log(success ? '✅ Email test completed successfully' : '❌ Email test failed');
  })
  .catch(err => {
    console.error('Unhandled error in email test:', err);
  });