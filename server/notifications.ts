import { MailService } from '@sendgrid/mail';

/**
 * Notification Service
 * 
 * Handles all email and notification functionality with graceful fallbacks
 * when SendGrid API key is not available
 */
 
// Configuration state
let emailEnabled = false;
const mailService = new MailService();

// Try to initialize SendGrid if API key is available
try {
  if (process.env.SENDGRID_API_KEY) {
    mailService.setApiKey(process.env.SENDGRID_API_KEY);
    emailEnabled = true;
    console.log("Email notifications enabled with SendGrid");
  } else {
    console.log("SendGrid API key not found. Email notifications will be logged but not sent.");
  }
} catch (error) {
  console.error("Failed to initialize SendGrid:", error);
  console.log("Email notifications will be logged but not sent.");
}

// Use SendGrid's mail data interface
interface EmailData {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
  // Optional SendGrid-specific fields  
  templateId?: string;
  dynamicTemplateData?: {[key: string]: any};
}

/**
 * Send an email notification
 * 
 * If SendGrid is not configured, this will log the email content
 * but won't attempt to send it.
 */
export async function sendEmail(emailData: EmailData): Promise<boolean> {
  try {
    // Always log the email for debugging purposes
    console.log(`[EMAIL ${emailEnabled ? 'SENDING' : 'WOULD SEND'}]`, {
      to: emailData.to,
      subject: emailData.subject
    });
    
    // Only try to send the email if SendGrid is properly configured
    if (emailEnabled) {
      // Create a valid mail data object with only defined properties
      const mailDataToSend: any = {
        to: emailData.to,
        from: emailData.from,
        subject: emailData.subject,
      };
      
      // Only add properties that are defined
      if (emailData.text) mailDataToSend.text = emailData.text;
      if (emailData.html) mailDataToSend.html = emailData.html;
      if (emailData.templateId) mailDataToSend.templateId = emailData.templateId;
      if (emailData.dynamicTemplateData) mailDataToSend.dynamicTemplateData = emailData.dynamicTemplateData;
      
      await mailService.send(mailDataToSend);
      console.log(`Email sent successfully to ${emailData.to}`);
    } else {
      console.log(`Email would be sent to ${emailData.to} (SendGrid not configured)`);
    }
    
    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}

/**
 * Send a schedule confirmation email
 */
export async function sendScheduleConfirmationEmail(
  recipientEmail: string,
  scheduleData: {
    id: number;
    dockName: string;
    facilityName: string;
    startTime: Date;
    endTime: Date;
    truckNumber: string;
    customerName?: string;
    type: string;
    driverName?: string;
    driverPhone?: string;
    carrierName?: string;
    mcNumber?: string;
    timezone?: string;
  }
): Promise<boolean> {
  // Don't attempt to send if no recipient email
  if (!recipientEmail) {
    console.log("No recipient email provided, skipping confirmation email");
    return false;
  }
  
  const formattedDate = scheduleData.startTime.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric', 
    month: 'long', 
    day: 'numeric'
  });
  
  // Format facility time (using the timezone from the facility if provided)
  const facilityTimezone = scheduleData.timezone || 'America/New_York';
  
  // Format start and end times in facility's timezone
  const facilityStartTime = scheduleData.startTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: facilityTimezone
  });
  
  const facilityEndTime = scheduleData.endTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: facilityTimezone
  });
  
  // Get the timezone abbreviation (EDT, PDT, etc.)
  const facilityTzAbbr = new Intl.DateTimeFormat('en-US', {
    timeZone: facilityTimezone,
    timeZoneName: 'short'
  }).formatToParts(scheduleData.startTime)
    .find(part => part.type === 'timeZoneName')?.value || '';
  
  // Format time in recipient's local timezone (best guess, will show server time)
  const localStartTime = scheduleData.startTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  const localEndTime = scheduleData.endTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  // Get local timezone abbreviation
  const localTzAbbr = new Intl.DateTimeFormat('en-US', {
    timeZoneName: 'short'
  }).formatToParts(scheduleData.startTime)
    .find(part => part.type === 'timeZoneName')?.value || '';
  
  // Create a confirmation code with HC prefix
  const confirmationCode = `HC${scheduleData.id}`;
  
  const emailData: EmailData = {
    to: recipientEmail,
    from: 'noreply@dockoptimizer.com', // This should be your verified SendGrid sender
    subject: `Dock Appointment Confirmation #${scheduleData.id}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4CAF50;">Dock Appointment Confirmed</h2>
        <p>Your appointment has been successfully scheduled. Please save your confirmation code for reference.</p>
        
        <div style="background-color: #f0f9f0; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center;">
          <h3 style="margin-top: 0;">Confirmation Code</h3>
          <p style="font-size: 24px; font-weight: bold;">${confirmationCode}</p>
        </div>
        
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Appointment Details</h3>
          <p><strong>Date:</strong> ${formattedDate}</p>
          <p><strong>Facility time:</strong> ${facilityStartTime} - ${facilityEndTime} (${facilityTzAbbr})</p>
          <p><strong>Your local time:</strong> ${localStartTime} - ${localEndTime} (${localTzAbbr})</p>
          <p><strong>Facility:</strong> ${scheduleData.facilityName}</p>
          <p><strong>Dock:</strong> ${scheduleData.dockName}</p>
        </div>
        
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Contact Information</h3>
          <p><strong>Company:</strong> ${scheduleData.customerName || 'N/A'}</p>
          <p><strong>Contact:</strong> ${scheduleData.driverName || 'N/A'}</p>
          <p><strong>Phone:</strong> ${scheduleData.driverPhone || 'N/A'}</p>
          <p><strong>Email:</strong> ${recipientEmail}</p>
        </div>
        
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Carrier Information</h3>
          <p><strong>Carrier:</strong> ${scheduleData.carrierName || 'N/A'} ${scheduleData.mcNumber ? `(MC#: ${scheduleData.mcNumber})` : ''}</p>
          <p><strong>Driver:</strong> ${scheduleData.driverName || 'N/A'}</p>
          <p><strong>Truck:</strong> ${scheduleData.truckNumber || 'N/A'}</p>
        </div>
        
        <p>Please arrive at your scheduled time. If you need to modify or cancel this appointment, please contact the facility.</p>
        
        <div style="margin-top: 30px; font-size: 12px; color: #666;">
          <p>This is an automated message from Dock Optimizer. Please do not reply to this email.</p>
        </div>
      </div>
    `,
    text: `
      Dock Appointment Confirmed
      
      Your appointment has been successfully scheduled. Please save your confirmation code for reference.
      
      Confirmation Code: ${confirmationCode}
      
      Appointment Details:
      Date: ${formattedDate}
      Facility time: ${facilityStartTime} - ${facilityEndTime} (${facilityTzAbbr})
      Your local time: ${localStartTime} - ${localEndTime} (${localTzAbbr})
      Facility: ${scheduleData.facilityName}
      Dock: ${scheduleData.dockName}
      
      Contact Information:
      Company: ${scheduleData.customerName || 'N/A'}
      Contact: ${scheduleData.driverName || 'N/A'}
      Phone: ${scheduleData.driverPhone || 'N/A'}
      Email: ${recipientEmail}
      
      Carrier Information:
      Carrier: ${scheduleData.carrierName || 'N/A'} ${scheduleData.mcNumber ? `(MC#: ${scheduleData.mcNumber})` : ''}
      Driver: ${scheduleData.driverName || 'N/A'}
      Truck: ${scheduleData.truckNumber || 'N/A'}
      
      Please arrive at your scheduled time. If you need to modify or cancel this appointment, please contact the facility.
      
      This is an automated message from Dock Optimizer. Please do not reply to this email.
    `
  };
  
  return sendEmail(emailData);
}