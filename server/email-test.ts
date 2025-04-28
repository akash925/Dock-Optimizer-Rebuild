import * as fs from 'fs';
import * as path from 'path';
import { sendScheduleConfirmationEmail } from './notifications';

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
    const emailContent = await sendScheduleConfirmationEmail("test@example.com", sampleData);
    
    // Save the generated HTML to a file for inspection
    const emailFunction = sendScheduleConfirmationEmail.toString();
    
    // Extract the HTML template from the function
    const htmlMatch = emailFunction.match(/html: `([\s\S]*?)`,\s*text:/);
    const textMatch = emailFunction.match(/text: `([\s\S]*?)`\s*\};/);
    
    if (htmlMatch && htmlMatch[1]) {
      // Replace template variables with actual values
      let htmlTemplate = htmlMatch[1];
      
      // Manually replace variables with sample data
      // Create a confirmation code with HC prefix
      const confirmationCode = `HC${sampleData.id}`;
      
      // Format dates
      const formattedDate = sampleData.startTime.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric', 
        month: 'long', 
        day: 'numeric'
      });
      
      // Format facility time
      const facilityTimezone = sampleData.timezone || 'America/New_York';
      
      // Format start and end times in facility's timezone
      const facilityStartTime = sampleData.startTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: facilityTimezone
      });
      
      const facilityEndTime = sampleData.endTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: facilityTimezone
      });
      
      // Get the timezone abbreviation (EDT, PDT, etc.)
      const facilityTzAbbr = new Intl.DateTimeFormat('en-US', {
        timeZone: facilityTimezone,
        timeZoneName: 'short'
      }).formatToParts(sampleData.startTime)
        .find(part => part.type === 'timeZoneName')?.value || '';
      
      // Format time in recipient's local timezone (best guess, will show server time)
      const localStartTime = sampleData.startTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const localEndTime = sampleData.endTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });
      
      // Get local timezone abbreviation
      const localTzAbbr = new Intl.DateTimeFormat('en-US', {
        timeZoneName: 'short'
      }).formatToParts(sampleData.startTime)
        .find(part => part.type === 'timeZoneName')?.value || '';
      
      // Replace variables in the template
      htmlTemplate = htmlTemplate
        .replace(/\${confirmationCode}/g, confirmationCode)
        .replace(/\${formattedDate}/g, formattedDate)
        .replace(/\${facilityStartTime}/g, facilityStartTime)
        .replace(/\${facilityEndTime}/g, facilityEndTime)
        .replace(/\${facilityTzAbbr}/g, facilityTzAbbr)
        .replace(/\${localStartTime}/g, localStartTime)
        .replace(/\${localEndTime}/g, localEndTime)
        .replace(/\${localTzAbbr}/g, localTzAbbr)
        .replace(/\${scheduleData.facilityName}/g, sampleData.facilityName)
        .replace(/\${scheduleData.dockName}/g, sampleData.dockName)
        .replace(/\${scheduleData.customerName \|\| 'N\/A'}/g, sampleData.customerName || 'N/A')
        .replace(/\${scheduleData.driverName \|\| 'N\/A'}/g, sampleData.driverName || 'N/A')
        .replace(/\${scheduleData.driverPhone \|\| 'N\/A'}/g, sampleData.driverPhone || 'N/A')
        .replace(/\${recipientEmail}/g, "test@example.com")
        .replace(/\${scheduleData.carrierName \|\| 'N\/A'}/g, sampleData.carrierName || 'N/A')
        .replace(/\${scheduleData.mcNumber \? `\(MC#: \${scheduleData.mcNumber}\)` : ''}/g, 
          sampleData.mcNumber ? `(MC#: ${sampleData.mcNumber})` : '')
        .replace(/\${scheduleData.truckNumber \|\| 'N\/A'}/g, sampleData.truckNumber || 'N/A');
      
      // Write the rendered template to a file
      fs.writeFileSync(path.join(__dirname, 'email-template-test.html'), htmlTemplate);
      console.log("✅ Email template test HTML saved to server/email-template-test.html");
    }
    
    if (textMatch && textMatch[1]) {
      // Save the text version too
      fs.writeFileSync(path.join(__dirname, 'email-template-test.txt'), textMatch[1]);
      console.log("✅ Email template test TEXT saved to server/email-template-test.txt");
    }
    
    return true;
  } catch (error) {
    console.error("Error testing email template:", error);
    return false;
  }
}

// Uncomment to run the test directly
// testEmailTemplate();