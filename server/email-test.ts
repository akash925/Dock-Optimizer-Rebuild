import * as fs from 'fs';
import * as path from 'path';
import { 
  sendConfirmationEmail, 
  sendRescheduleEmail, 
  sendCancellationEmail, 
  sendReminderEmail, 
  EnhancedSchedule 
} from './notifications';

/**
 * This is a development utility function to test email templates
 * It generates a sample email using the enhanced email template
 * and saves the HTML to a file for inspection
 */
export async function testEmailTemplate() {
  // Create a sample schedule with all the data we need
  const sampleData = {
    id: 46,
    dockName: "Dock 3",
    facilityName: "Sam Pride",
    startTime: new Date("2025-04-30T17:00:00Z"), // 5:00 PM UTC
    endTime: new Date("2025-04-30T18:00:00Z"),   // 6:00 PM UTC
    truckNumber: "10000",
    customerName: "Conmitto Inc.",
    type: "delivery",
    driverName: "Akash Agarwal",
    driverPhone: "4082303749",
    carrierName: "UPS",
    mcNumber: "MC178930",
    timezone: "America/New_York" // EDT
  };

  // Call the function to generate the email content
  try {
    // This is just for testing - we don't actually send the email
    // Create a more complete test schedule with required properties
    const testSchedule: EnhancedSchedule = {
      id: sampleData.id,
      facilityId: 6, // Sam Pride facility ID
      dockId: 3,
      carrierId: 5,
      appointmentTypeId: 12,
      truckNumber: "10000",
      trailerNumber: "TR-5678",
      driverName: "Akash Agarwal",
      driverPhone: "4082303749",
      driverEmail: 'test@example.com',
      customerName: "Conmitto Inc.",
      carrierName: "UPS",
      mcNumber: "MC178930",
      bolNumber: "BOL-1234",
      poNumber: "PO-5678",
      palletCount: "24",
      weight: "4500",
      appointmentMode: "trailer",
      startTime: new Date("2025-05-15T13:00:00"),
      endTime: new Date("2025-05-15T14:00:00"),
      actualStartTime: null,
      actualEndTime: null,
      type: 'inbound',
      status: 'scheduled',
      notes: "Please use dock entrance B",
      customFormData: null,
      createdBy: 1,
      createdAt: new Date(),
      lastModifiedAt: null,
      lastModifiedBy: null,
      
      // Enhanced properties for UI display
      facilityName: "Sam Pride",
      appointmentTypeName: "Standard Delivery",
      dockName: "Dock 3",
      timezone: "America/New_York"
    };
    
    const confirmationCode = `HC${sampleData.id}`;
    const emailRecipient = "test@example.com";
    
    // Test all email types
    
    // 1. Confirmation Email
    console.log("Testing confirmation email template...");
    const confirmationEmail = await sendConfirmationEmail(
      emailRecipient, 
      confirmationCode, 
      testSchedule
    );
    
    // 2. Reschedule Email (with old time)
    console.log("Testing reschedule email template...");
    const oldStartTime = new Date("2025-05-14T10:00:00");
    const oldEndTime = new Date("2025-05-14T11:00:00");
    const rescheduleEmail = await sendRescheduleEmail(
      emailRecipient, 
      confirmationCode, 
      testSchedule,
      oldStartTime,
      oldEndTime
    );
    
    // 3. Cancellation Email
    console.log("Testing cancellation email template...");
    const cancellationEmail = await sendCancellationEmail(
      emailRecipient, 
      confirmationCode, 
      testSchedule
    );
    
    // 4. Reminder Email (24 hours before)
    console.log("Testing reminder email template...");
    const reminderEmail = await sendReminderEmail(
      emailRecipient, 
      confirmationCode, 
      testSchedule,
      24 // hours until appointment
    );
    
    // Save all template outputs to files
    if (typeof confirmationEmail === 'object' && confirmationEmail !== null) {
      fs.writeFileSync('email-confirmation-test.html', confirmationEmail.html || 'No HTML content generated');
      fs.writeFileSync('email-confirmation-test.txt', confirmationEmail.text || 'No text content generated');
    }
    
    if (typeof rescheduleEmail === 'object' && rescheduleEmail !== null) {
      fs.writeFileSync('email-reschedule-test.html', rescheduleEmail.html || 'No HTML content generated');
      fs.writeFileSync('email-reschedule-test.txt', rescheduleEmail.text || 'No text content generated');
    }
    
    if (typeof cancellationEmail === 'object' && cancellationEmail !== null) {
      fs.writeFileSync('email-cancellation-test.html', cancellationEmail.html || 'No HTML content generated');
      fs.writeFileSync('email-cancellation-test.txt', cancellationEmail.text || 'No text content generated');
    }
    
    if (typeof reminderEmail === 'object' && reminderEmail !== null) {
      fs.writeFileSync('email-reminder-test.html', reminderEmail.html || 'No HTML content generated');
      fs.writeFileSync('email-reminder-test.txt', reminderEmail.text || 'No text content generated');
    }
    
    console.log("✅ All email template tests saved to project root");
    return true;
  } catch (error) {
    console.error("Error testing email templates:", error);
    return false;
  }
}

// Run the test automatically when imported
testEmailTemplate().then(result => {
  if (result) {
    console.log("✅ Email template test generated successfully");
  } else {
    console.error("❌ Email template test failed");
  }
});