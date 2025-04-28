import sgMail from '@sendgrid/mail';
import { Schedule } from '../shared/schema';
import { format } from 'date-fns';
import { formatToTimeZone, parseFromTimeZone } from 'date-fns-timezone';

// Enhanced schedule with UI-specific fields - extends the base Schedule type
// This type is used for email templates and notifications that need additional context
export interface EnhancedSchedule {
  // Core Schedule properties
  id: number;
  facilityId: number | null; // Now part of core properties
  dockId: number | null;
  carrierId: number | null;
  appointmentTypeId: number | null;
  truckNumber: string;
  trailerNumber: string | null;
  driverName: string | null;
  driverPhone: string | null;
  driverEmail: string | null;
  customerName: string | null;
  carrierName: string | null;
  mcNumber: string | null;
  bolNumber: string | null;
  poNumber: string | null;
  palletCount: string | null;
  weight: string | null;
  appointmentMode: string | null;
  startTime: Date;
  endTime: Date;
  actualStartTime: Date | null;
  actualEndTime: Date | null;
  type: string;
  status: string;
  notes: string | null;
  customFormData: any | null;
  createdBy: number;
  createdAt: Date;
  lastModifiedAt: Date | null;
  lastModifiedBy: number | null;
  
  // Enhanced properties for UI and notifications
  facilityName?: string;
  appointmentTypeName?: string;
  dockName?: string;
  timezone?: string;
}

// Initialize SendGrid if API key is available
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log('Email notifications enabled with SendGrid');
} else {
  console.warn('No SendGrid API key found. Email notifications will be disabled.');
}

/**
 * General-purpose email sending function
 */
export interface EmailParams {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  from?: string;
}

export async function sendEmail(params: EmailParams): Promise<{ html: string, text: string } | boolean> {
  if (!params.to || !params.subject) {
    console.error('Missing required email parameters (to, subject)');
    return false;
  }

  // Validate email address format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(params.to)) {
    console.error(`Invalid email address format: ${params.to}`);
    return false;
  }

  // Prepare the email message
  const msg = {
    to: params.to,
    from: params.from || process.env.SENDGRID_FROM_EMAIL || 'notifications@dockoptimizer.com',
    subject: params.subject,
    text: params.text || 'No content provided',
    html: params.html || '<p>No content provided</p>',
  };

  // In development mode, just return the content for testing
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEV MODE] Email would be sent to: ${params.to} with subject: ${params.subject}`);
    console.log('Email HTML preview:');
    console.log(msg.html.substring(0, 500) + (msg.html.length > 500 ? '...' : ''));
    return {
      html: msg.html,
      text: msg.text
    };
  }

  // In production, attempt to send via SendGrid
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('SendGrid API key not set, skipping email send');
    return false;
  }

  // Check that from email is valid and configured correctly
  if (!emailRegex.test(msg.from)) {
    console.error(`Invalid sender email address format: ${msg.from}. Using default.`);
    msg.from = 'notifications@dockoptimizer.com';
  }

  try {
    await sgMail.send(msg);
    console.log(`Email sent successfully to ${params.to}`);
    return true;
  } catch (error: unknown) {
    console.error('Error sending email:', error);
    if (error && typeof error === 'object' && 'response' in error && error.response && typeof error.response === 'object' && 'body' in error.response) {
      console.error(`SendGrid API error: ${JSON.stringify(error.response.body)}`);
    }
    return false;
  }
}

/**
 * Format a date for a specific timezone
 */
function formatDateForTimezone(date: Date, timezone: string, formatStr: string): string {
  try {
    // Check if date is valid before proceeding
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      console.warn(`Invalid date provided to formatDateForTimezone: ${date}`);
      // Return current date/time as fallback
      const now = new Date();
      return formatToTimeZone(now, formatStr, { timeZone: timezone });
    }
    
    // Create a safe copy of the date
    const safeDate = new Date(date.getTime());
    return formatToTimeZone(safeDate, formatStr, { timeZone: timezone });
  } catch (error) {
    console.error(`Error formatting date for timezone ${timezone}:`, error);
    // Fallback to simple format if timezone formatting fails
    try {
      return format(date, formatStr);
    } catch (fallbackError) {
      console.error('Fallback formatting also failed:', fallbackError);
      // Ultimate fallback - return basic ISO string or formatted current date
      return new Date().toLocaleString();
    }
  }
}

/**
 * Get the abbreviated timezone name
 * @param timezone - The IANA timezone identifier (e.g., 'America/New_York')
 * @param date - The date to use for determining DST status
 * @returns The timezone abbreviation (e.g., 'EDT', 'EST')
 */
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
    
    // Log input values for debugging
    console.log(`[getTimezoneAbbr] Using timezone: ${timezone}, date: ${date.toISOString()}`);
    
    // This will return something like "EST" or "EDT" depending on daylight saving time
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short'
    }).formatToParts(date)
      .find(part => part.type === 'timeZoneName');
    
    if (parts?.value) {
      console.log(`[getTimezoneAbbr] Found abbreviation: ${parts.value}`);
      return parts.value;
    }
    
    // Fall back to common abbreviations or region name
    const region = timezone.split('/').pop() || '';
    console.log(`[getTimezoneAbbr] Falling back to region: ${region}`);
    
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
    
    console.log(`[getTimezoneAbbr] Using abbreviation: ${abbr}`);
    return abbr;
  } catch (error) {
    console.error(`Error getting timezone abbreviation for ${timezone}:`, error);
    return 'GMT'; // Final fallback
  }
}

/**
 * Send a confirmation email for a new or rescheduled appointment
 */
export async function sendConfirmationEmail(
  to: string,
  confirmationCode: string,
  schedule: EnhancedSchedule
): Promise<{ html: string, text: string } | boolean> {
  const facilityTimezone = schedule.timezone || 'America/New_York';
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';

  // Safely parse dates
  const parseDate = (dateInput: Date | string | null): Date => {
    if (!dateInput) return new Date(); // Fallback to current time if null/undefined
    
    if (dateInput instanceof Date) {
      return isNaN(dateInput.getTime()) ? new Date() : dateInput;
    }
    
    // If it's a string, attempt to parse it
    try {
      const parsed = new Date(dateInput);
      return isNaN(parsed.getTime()) ? new Date() : parsed;
    } catch (e: unknown) {
      console.error(`Failed to parse date: ${dateInput}`, e);
      return new Date();
    }
  };

  // Get safe date objects
  const startDate = parseDate(schedule.startTime);
  const endDate = parseDate(schedule.endTime);
  
  console.log(`[Email] Parsed dates: Start=${startDate.toISOString()}, End=${endDate.toISOString()}`);
  
  // Format times in both facility and user timezone
  const facilityStart = formatDateForTimezone(
    startDate, 
    facilityTimezone, 
    'EEEE, MMMM d, yyyy h:mm aa'
  );
  const facilityEnd = formatDateForTimezone(
    endDate, 
    facilityTimezone, 
    'h:mm aa'
  );
  const userStart = formatDateForTimezone(
    startDate, 
    userTimezone, 
    'EEEE, MMMM d, yyyy h:mm aa'
  );
  const userEnd = formatDateForTimezone(
    endDate, 
    userTimezone, 
    'h:mm aa'
  );

  // Get timezone abbreviations
  const facilityTzAbbr = getTimezoneAbbr(facilityTimezone, startDate);
  const userTzAbbr = getTimezoneAbbr(userTimezone, startDate);

  const facilityTimeRange = `${facilityStart} - ${facilityEnd} ${facilityTzAbbr}`;
  const userTimeRange = `${userStart} - ${userEnd} ${userTzAbbr}`;

  // Host URL with potential fallback
  const host = process.env.HOST_URL || 'https://dockoptimizer.replit.app';

  // Create reschedule/cancel links
  const rescheduleLink = `${host}/reschedule?code=${confirmationCode}`;
  const cancelLink = `${host}/cancel?code=${confirmationCode}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #00A86B; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0;">Dock Appointment Confirmation</h1>
        <p style="margin-top: 5px;">Confirmation #: ${confirmationCode}</p>
      </div>
      
      <div style="padding: 20px;">
        <p>Your dock appointment has been confirmed. Please arrive 15 minutes before your scheduled time.</p>

        <div style="background-color: #f5f5f5; border-left: 4px solid #00A86B; padding: 15px; margin: 20px 0;">
          <h2 style="margin-top: 0; color: #333;">Appointment Details</h2>
          
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666; width: 140px;">Facility:</td>
              <td style="padding: 8px 0;"><strong>${schedule.facilityName || 'Unknown Facility'}</strong></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Appointment:</td>
              <td style="padding: 8px 0;"><strong>${schedule.appointmentTypeName || 'Standard Appointment'}</strong></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Dock:</td>
              <td style="padding: 8px 0;"><strong>${schedule.dockName || 'Not scheduled yet'}</strong></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Facility Time:</td>
              <td style="padding: 8px 0;"><strong>${facilityTimeRange}</strong></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Your Local Time:</td>
              <td style="padding: 8px 0;"><strong>${userTimeRange}</strong></td>
            </tr>
            ${schedule.driverName ? `
            <tr>
              <td style="padding: 8px 0; color: #666;">Driver:</td>
              <td style="padding: 8px 0;"><strong>${schedule.driverName}</strong></td>
            </tr>` : ''}
            ${schedule.driverPhone ? `
            <tr>
              <td style="padding: 8px 0; color: #666;">Driver Phone:</td>
              <td style="padding: 8px 0;"><strong>${schedule.driverPhone}</strong></td>
            </tr>` : ''}
            ${schedule.carrierId ? `
            <tr>
              <td style="padding: 8px 0; color: #666;">Carrier:</td>
              <td style="padding: 8px 0;"><strong>${schedule.carrierName || 'Unknown Carrier'}</strong></td>
            </tr>` : ''}
            ${schedule.truckNumber ? `
            <tr>
              <td style="padding: 8px 0; color: #666;">Truck #:</td>
              <td style="padding: 8px 0;"><strong>${schedule.truckNumber}</strong></td>
            </tr>` : ''}
            ${schedule.trailerNumber ? `
            <tr>
              <td style="padding: 8px 0; color: #666;">Trailer #:</td>
              <td style="padding: 8px 0;"><strong>${schedule.trailerNumber}</strong></td>
            </tr>` : ''}
            ${schedule.poNumber ? `
            <tr>
              <td style="padding: 8px 0; color: #666;">PO #:</td>
              <td style="padding: 8px 0;"><strong>${schedule.poNumber}</strong></td>
            </tr>` : ''}
            ${schedule.notes ? `
            <tr>
              <td style="padding: 8px 0; color: #666;">Notes:</td>
              <td style="padding: 8px 0;"><strong>${schedule.notes}</strong></td>
            </tr>` : ''}
          </table>
        </div>
        
        <div style="margin: 30px 0; text-align: center;">
          <p style="margin-bottom: 15px;">Need to make changes to your appointment?</p>
          
          <a href="${rescheduleLink}" 
             style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-right: 10px; display: inline-block;">
            Reschedule
          </a>
          
          <a href="${cancelLink}" 
             style="background-color: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Cancel
          </a>
        </div>
        
        <p>If you have any questions, please contact the facility directly.</p>
      </div>
      
      <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
        <p>This is an automated message from Dock Optimizer. Please do not reply to this email.</p>
      </div>
    </div>
  `;

  const text = `
    Dock Appointment Confirmation
    Confirmation #: ${confirmationCode}
    
    Your dock appointment has been confirmed. Please arrive 15 minutes before your scheduled time.
    
    APPOINTMENT DETAILS
    ------------------
    Facility: ${schedule.facilityName || 'Unknown Facility'}
    Appointment: ${schedule.appointmentTypeName || 'Standard Appointment'}
    Dock: ${schedule.dockName || 'Not scheduled yet'}
    
    Facility Time: ${facilityTimeRange}
    Your Local Time: ${userTimeRange}
    ${schedule.driverName ? `Driver: ${schedule.driverName}` : ''}
    ${schedule.driverPhone ? `Driver Phone: ${schedule.driverPhone}` : ''}
    ${schedule.carrierId ? `Carrier: ${schedule.carrierName || 'Unknown Carrier'}` : ''}
    ${schedule.truckNumber ? `Truck #: ${schedule.truckNumber}` : ''}
    ${schedule.trailerNumber ? `Trailer #: ${schedule.trailerNumber}` : ''}
    ${schedule.poNumber ? `PO #: ${schedule.poNumber}` : ''}
    ${schedule.notes ? `Notes: ${schedule.notes}` : ''}
    
    MANAGE YOUR APPOINTMENT
    ---------------------
    Need to make changes? 
    
    Reschedule: ${rescheduleLink}
    Cancel: ${cancelLink}
    
    If you have any questions, please contact the facility directly.
    
    This is an automated message from Dock Optimizer. Please do not reply to this email.
  `;

  return sendEmail({
    to,
    subject: `Dock Appointment Confirmation #${confirmationCode}`,
    html,
    text,
  });
}