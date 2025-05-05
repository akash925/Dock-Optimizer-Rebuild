import sgMail from '@sendgrid/mail';
import { format } from 'date-fns';
import { formatToTimeZone } from 'date-fns-timezone';
import { EnhancedSchedule } from './notifications';

// Initialize SendGrid with API key
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.warn('[EMAIL] SendGrid API key not found. Email functionality will be limited.');
}

// Helper function to get timezone abbreviation
function getTimezoneAbbr(timezone: string, date: Date): string {
  try {
    // Ensure timezone is valid
    if (!timezone) {
      console.warn('No timezone provided to getTimezoneAbbr, using default');
      timezone = 'America/New_York';
    }
    
    // Check if the date is valid before formatting
    // If invalid, use current date as a fallback
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      console.warn(`Invalid date provided to getTimezoneAbbr: ${date}, using current date`);
      date = new Date();
    }
    
    // This will return something like "EST" or "EDT" depending on daylight saving time
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short'
    }).formatToParts(date)
      .find(part => part.type === 'timeZoneName');
    
    if (parts?.value) {
      return parts.value;
    }
    
    // Fall back to common abbreviations or region name
    const region = timezone.split('/').pop() || '';
    
    // Return common timezone abbreviations or the region name
    let abbr: string;
    switch(region) {
      case 'New_York': abbr = 'ET'; break;
      case 'Chicago': abbr = 'CT'; break;
      case 'Denver': abbr = 'MT'; break;
      case 'Phoenix': abbr = 'MST'; break;
      case 'Los_Angeles': abbr = 'PT'; break;
      case 'Anchorage': abbr = 'AKST'; break;
      case 'Honolulu': abbr = 'HST'; break;
      default: abbr = region || 'GMT';
    }
    
    return abbr;
  } catch (error) {
    console.error(`Error getting timezone abbreviation for ${timezone}:`, error);
    return 'GMT'; // Final fallback
  }
}

/**
 * Send a check-out completion email with appointment log details
 */
export async function sendCheckoutCompletionEmail(
  to: string,
  confirmationCode: string,
  schedule: EnhancedSchedule
): Promise<{ html: string, text: string, attachments?: any[] } | boolean> {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('[EMAIL] SendGrid API key not found. Cannot send check-out completion email.');
    return false;
  }
  
  try {
    // Get the base URL for the application
    const host = process.env.HOST_URL || 'https://dockoptimizer.replit.app';
    
    // Safely get timezone with fallback
    const facilityTimezone = schedule.timezone || 'America/New_York';
    const timezoneAbbr = getTimezoneAbbr(facilityTimezone, schedule.startTime);
    
    // Format dates for display
    const formatDate = (date: Date | null): string => {
      if (!date) return 'Not specified';
      
      try {
        // Use date-fns-timezone for correct timezone handling
        const formattedDate = formatToTimeZone(date, 'MMMM D, YYYY', { timeZone: facilityTimezone });
        return formattedDate;
      } catch (e) {
        console.error(`[EMAIL] Error formatting date ${date}:`, e);
        // Fallback to local timezone
        return format(date, 'MMMM d, yyyy');
      }
    };
    
    const formatTime = (date: Date | null): string => {
      if (!date) return 'Not specified';
      
      try {
        // Use date-fns-timezone for correct timezone handling
        return formatToTimeZone(date, 'h:mm A', { timeZone: facilityTimezone });
      } catch (e) {
        console.error(`[EMAIL] Error formatting time ${date}:`, e);
        // Fallback to local timezone
        return format(date, 'h:mm a');
      }
    };
    
    // Format the date and time for the email
    const appointmentDate = formatDate(schedule.startTime);
    const scheduledStartTime = formatTime(schedule.startTime);
    const scheduledEndTime = formatTime(schedule.endTime);
    const actualStartTime = formatTime(schedule.actualStartTime);
    const actualEndTime = formatTime(schedule.actualEndTime);
    
    // Parse customFormData to extract check-out notes and potential photo path
    let checkoutNotes = '';
    let photoUrl = '';
    
    if (schedule.customFormData) {
      try {
        const customData = typeof schedule.customFormData === 'string' 
          ? JSON.parse(schedule.customFormData) 
          : schedule.customFormData;
        
        checkoutNotes = customData.checkoutNotes || '';
        
        // Get photo URL if available (formatted as a viewable URL)
        if (customData.checkoutPhoto) {
          // Create a full URL to the photo if it's a relative path
          if (customData.checkoutPhoto.startsWith('/')) {
            photoUrl = `${host}${customData.checkoutPhoto}`;
          } else {
            photoUrl = customData.checkoutPhoto;
          }
          console.log(`[EMAIL] Including photo URL in completion email: ${photoUrl}`);
        }
      } catch (e) {
        console.warn("[EMAIL] Failed to parse customFormData:", e);
      }
    }
    
    // Generate HTML and text email content
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
        <div style="background-color: #4CAF50; color: white; padding: 15px; text-align: center; border-radius: 5px 5px 0 0;">
          <h2 style="margin: 0;">Appointment Completed</h2>
        </div>
        
        <div style="padding: 20px; background-color: #f9f9f9;">
          <p>Your dock appointment has been <strong>completed</strong>. Thank you for your business!</p>
          
          <div style="margin: 20px 0; padding: 15px; border: 1px solid #ddd; background-color: white; border-radius: 5px;">
            <h3 style="margin-top: 0; color: #333; border-bottom: 1px solid #eee; padding-bottom: 10px;">Appointment Summary</h3>
            
            <p><strong>Confirmation Code:</strong> ${confirmationCode}</p>
            <p><strong>Facility:</strong> ${schedule.facilityName || 'Not specified'}</p>
            <p><strong>Date:</strong> ${appointmentDate}</p>
            <p><strong>Scheduled Time:</strong> ${scheduledStartTime} - ${scheduledEndTime} ${timezoneAbbr}</p>
            <p><strong>Type:</strong> ${schedule.appointmentTypeName || 'Standard'}</p>
            ${schedule.type ? `<p><strong>Direction:</strong> ${schedule.type === 'inbound' ? 'Inbound (Delivery)' : 'Outbound (Pickup)'}</p>` : ''}
            ${schedule.carrierName ? `<p><strong>Carrier:</strong> ${schedule.carrierName}</p>` : ''}
            ${schedule.customerName ? `<p><strong>Customer:</strong> ${schedule.customerName}</p>` : ''}
            ${schedule.driverName ? `<p><strong>Driver:</strong> ${schedule.driverName}</p>` : ''}
            ${schedule.truckNumber ? `<p><strong>Truck Number:</strong> ${schedule.truckNumber}</p>` : ''}
            ${schedule.trailerNumber ? `<p><strong>Trailer Number:</strong> ${schedule.trailerNumber}</p>` : ''}
            
            <div style="margin-top: 20px; border-top: 1px solid #eee; padding-top: 15px;">
              <h4 style="color: #333; margin-top: 0;">Check-In/Out Details</h4>
              <p><strong>Check-In Time:</strong> ${actualStartTime}</p>
              <p><strong>Check-Out Time:</strong> ${actualEndTime}</p>
              ${checkoutNotes ? `<p><strong>Check-Out Notes:</strong> ${checkoutNotes}</p>` : ''}
              
              ${photoUrl ? `
              <div style="margin-top: 15px;">
                <p><strong>Check-Out Photo:</strong></p>
                <img src="${photoUrl}" alt="Check-out photo" style="max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 5px;" />
              </div>
              ` : ''}
            </div>
            
            ${schedule.notes ? `
            <div style="margin-top: 15px;">
              <p><strong>Appointment Notes:</strong> ${schedule.notes}</p>
            </div>
            ` : ''}
          </div>
          
          <p>Thank you for your business. If you have any questions about your completed appointment, please contact us.</p>
          
          <p>Best regards,<br>
          Dock Scheduling Team</p>
        </div>
        
        <div style="padding: 15px; background-color: #eeeeee; border-radius: 0 0 5px 5px; font-size: 12px; text-align: center; color: #666;">
          <p>This is an automated message, please do not reply directly to this email.</p>
          <p>&copy; ${new Date().getFullYear()} Dock Optimizer. All rights reserved.</p>
        </div>
      </div>
    `;
    
    // Plain text version for email clients that don't support HTML
    const textContent = `
APPOINTMENT COMPLETED

Your dock appointment has been completed. Thank you for your business!

APPOINTMENT SUMMARY
-------------------
Confirmation Code: ${confirmationCode}
Facility: ${schedule.facilityName || 'Not specified'}
Date: ${appointmentDate}
Scheduled Time: ${scheduledStartTime} - ${scheduledEndTime} ${timezoneAbbr}
Type: ${schedule.appointmentTypeName || 'Standard'}
${schedule.type ? `Direction: ${schedule.type === 'inbound' ? 'Inbound (Delivery)' : 'Outbound (Pickup)'}` : ''}
${schedule.carrierName ? `Carrier: ${schedule.carrierName}` : ''}
${schedule.customerName ? `Customer: ${schedule.customerName}` : ''}
${schedule.driverName ? `Driver: ${schedule.driverName}` : ''}
${schedule.truckNumber ? `Truck Number: ${schedule.truckNumber}` : ''}
${schedule.trailerNumber ? `Trailer Number: ${schedule.trailerNumber}` : ''}

CHECK-IN/OUT DETAILS
-------------------
Check-In Time: ${actualStartTime}
Check-Out Time: ${actualEndTime}
${checkoutNotes ? `Check-Out Notes: ${checkoutNotes}` : ''}
${photoUrl ? `Check-Out Photo: ${photoUrl}` : ''}

${schedule.notes ? `Appointment Notes: ${schedule.notes}` : ''}

Thank you for your business. If you have any questions about your completed appointment, please contact us.

Best regards,
Dock Scheduling Team

This is an automated message, please do not reply directly to this email.
© ${new Date().getFullYear()} Dock Optimizer. All rights reserved.
    `;
    
    // Create the email message object
    const msg = {
      to,
      from: process.env.SENDGRID_FROM_EMAIL || 'notifications@dockoptimizer.com',
      subject: `Dock Appointment Completed - ${confirmationCode}`,
      text: textContent,
      html: htmlContent
    };
    
    // Log that we're about to send
    console.log(`[EMAIL] Sending check-out completion email to ${to} for confirmation code ${confirmationCode}`);
    
    // Return the email content for testing or preview
    if (process.env.NODE_ENV === 'development' && process.env.EMAIL_PREVIEW === 'true') {
      console.log('[EMAIL] Email preview mode is enabled - returning content without sending');
      return {
        html: htmlContent,
        text: textContent
      };
    }
    
    // Send the email
    try {
      await sgMail.send(msg);
      console.log(`[EMAIL] Successfully sent check-out completion email to ${to}`);
      return true;
    } catch (sendError) {
      console.error('[EMAIL] SendGrid error sending check-out completion email:', sendError);
      
      // Provide more detailed error information for debugging
      if (sendError.response) {
        console.error('[EMAIL] SendGrid API error response:', {
          body: sendError.response.body,
          statusCode: sendError.response.statusCode
        });
      }
      
      // Even if sending fails, return the content so the checkout process completes
      console.log('[EMAIL] Returning email content for checkout process to continue');
      return {
        html: htmlContent,
        text: textContent
      };
    }
  } catch (error) {
    console.error('[EMAIL] Error preparing check-out completion email:', error);
    return false;
  }
}

// Helper function to send email (allows us to share code with notifications.ts)
export async function sendEmail(params: {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  attachments?: Array<{
    content: string;
    filename: string;
    type: string;
    disposition: string;
  }>;
}): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('[EMAIL] SendGrid API key not found. Cannot send email.');
    return false;
  }
  
  try {
    // Setup SendGrid is already initialized at the top of the file
    
    // Get the configured sender email or use fallback
    const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'notifications@dockoptimizer.com';
    
    // Send the email
    const msg = {
      to: params.to,
      from: params.from || fromEmail,
      subject: params.subject,
      text: params.text || '',
      html: params.html || '',
      attachments: params.attachments || []
    };
    
    await sgMail.send(msg);
    return true;
  } catch (error) {
    console.error('[EMAIL] Error sending email:', error);
    return false;
  }
}