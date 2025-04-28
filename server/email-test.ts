import * as fs from 'fs';
import * as path from 'path';
import { sendConfirmationEmail, EnhancedSchedule } from './notifications';

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

  // Generate the email data without actually sending it
  const emailData = {
    to: "test@example.com",
    from: 'noreply@dockoptimizer.com',
    subject: `Dock Appointment Confirmation #${sampleData.id}`,
    html: '', // Will be filled by the email function
    text: ''  // Will be filled by the email function
  };

  // Call the function to generate the email content
  try {
    // This is just for testing - we don't actually send the email
    // Create a more complete test schedule with required properties
    const testSchedule: EnhancedSchedule = {
      id: sampleData.id,
      dockId: null,
      carrierId: null,
      appointmentTypeId: null,
      truckNumber: "10000",
      trailerNumber: null,
      driverName: "Akash Agarwal",
      driverPhone: "4082303749",
      driverEmail: 'test@example.com',
      customerName: null,
      carrierName: null,
      mcNumber: null,
      bolNumber: null,
      poNumber: null,
      palletCount: null,
      weight: null,
      appointmentMode: "trailer",
      startTime: new Date("2023-04-03T13:00:00"),
      endTime: new Date("2023-04-03T14:00:00"),
      actualStartTime: null,
      actualEndTime: null,
      type: 'inbound',
      status: 'scheduled',
      notes: null,
      customFormData: null,
      createdBy: 1,
      createdAt: new Date(),
      lastModifiedAt: null,
      lastModifiedBy: null,
      
      // Enhanced properties for UI display
      facilityName: "Sam Pride",
      appointmentTypeName: "Standard Appointment",
      dockName: "Dock 3",
      timezone: "America/New_York"
    };
    
    const emailContent = await sendConfirmationEmail("test@example.com", `HC${sampleData.id}`, testSchedule);
    
    // Save the generated HTML to a file for inspection
    const emailFunction = sendConfirmationEmail.toString();
    
    // Handle both boolean and object returns from sendConfirmationEmail
    if (typeof emailContent === 'object' && emailContent !== null) {
      fs.writeFileSync('email-template-test.html', emailContent.html || 'No HTML content generated');
      fs.writeFileSync('email-template-test.txt', emailContent.text || 'No text content generated');
    } else {
      fs.writeFileSync('email-template-test.html', 'Email would be sent in production environment');
      fs.writeFileSync('email-template-test.txt', 'Email would be sent in production environment');
    }
    
    console.log("✅ Email template test HTML and text saved to project root");
    return true;
  } catch (error) {
    console.error("Error testing email template:", error);
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