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
  
  const formattedStartTime = scheduleData.startTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  const formattedEndTime = scheduleData.endTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  const emailData: EmailData = {
    to: recipientEmail,
    from: 'noreply@dockoptimizer.com', // This should be your verified SendGrid sender
    subject: `Dock Appointment Confirmation #${scheduleData.id}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4CAF50;">Dock Appointment Confirmed</h2>
        <p>Your ${scheduleData.type} appointment has been scheduled successfully.</p>
        
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Appointment Details</h3>
          <p><strong>Confirmation #:</strong> ${scheduleData.id}</p>
          <p><strong>Date:</strong> ${formattedDate}</p>
          <p><strong>Time:</strong> ${formattedStartTime} - ${formattedEndTime}</p>
          <p><strong>Facility:</strong> ${scheduleData.facilityName}</p>
          <p><strong>Dock:</strong> ${scheduleData.dockName}</p>
          <p><strong>Truck Number:</strong> ${scheduleData.truckNumber}</p>
          ${scheduleData.customerName ? `<p><strong>Customer:</strong> ${scheduleData.customerName}</p>` : ''}
        </div>
        
        <p>Please arrive at your scheduled time. If you need to modify or cancel this appointment, please contact the facility.</p>
        
        <div style="margin-top: 30px; font-size: 12px; color: #666;">
          <p>This is an automated message from Dock Optimizer. Please do not reply to this email.</p>
        </div>
      </div>
    `,
    text: `
      Dock Appointment Confirmed
      
      Your ${scheduleData.type} appointment has been scheduled successfully.
      
      Appointment Details:
      Confirmation #: ${scheduleData.id}
      Date: ${formattedDate}
      Time: ${formattedStartTime} - ${formattedEndTime}
      Facility: ${scheduleData.facilityName}
      Dock: ${scheduleData.dockName}
      Truck Number: ${scheduleData.truckNumber}
      ${scheduleData.customerName ? `Customer: ${scheduleData.customerName}` : ''}
      
      Please arrive at your scheduled time. If you need to modify or cancel this appointment, please contact the facility.
      
      This is an automated message from Dock Optimizer. Please do not reply to this email.
    `
  };
  
  return sendEmail(emailData);
}