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
  
  // Verify the FROM_EMAIL is correctly configured
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  // Check for common errors in SENDGRID_FROM_EMAIL
  if (!fromEmail) {
    console.warn('WARNING: SENDGRID_FROM_EMAIL not set. Please set a valid email address in environment variables.');
    console.warn('Emails will use the fallback address: notifications@dockoptimizer.com');
  } else if (fromEmail.startsWith('SG.')) {
    console.error('ERROR: SENDGRID_FROM_EMAIL appears to be an API key, not an email address.');
    console.error('Please update your environment variables:');
    console.error('  SENDGRID_API_KEY: Should be your API key starting with "SG."');
    console.error('  SENDGRID_FROM_EMAIL: Should be a valid sender email like "notifications@dockoptimizer.com"');
    console.warn('Emails will use the fallback address: notifications@dockoptimizer.com');
  } else if (!emailRegex.test(fromEmail)) {
    console.warn(`WARNING: Invalid email address format in SENDGRID_FROM_EMAIL: "${fromEmail}"`);
    console.warn('Emails will use the fallback address: notifications@dockoptimizer.com');
  } else {
    console.log(`Email sender address configured as: ${fromEmail}`);
  }
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
  attachments?: Array<{
    content: string;
    filename: string;
    type: string;
    disposition: string;
  }>;
}

/**
 * Generate an iCalendar (ICS) file content for a schedule
 * This follows RFC 5545 standard for calendar events
 */
export function generateICalEvent(
  schedule: EnhancedSchedule, 
  confirmationCode: string,
  cancelEvent: boolean = false
): string {
  // Get safe timezone, defaulting to Eastern Time
  const timezone = schedule.timezone || 'America/New_York';
  
  // Safely parse dates - handling both Date objects and string inputs
  const parseDate = (dateInput: Date | string | null): Date => {
    if (!dateInput) {
      console.warn('[iCal] Null date provided, using current time as fallback');
      return new Date();
    }
    
    // If it's already a Date object
    if (dateInput instanceof Date) {
      if (isNaN(dateInput.getTime())) {
        console.warn('[iCal] Invalid Date object provided, using current time as fallback');
        return new Date();
      }
      return dateInput;
    }
    
    // If it's a string, attempt to parse it
    try {
      const parsed = new Date(dateInput);
      if (isNaN(parsed.getTime())) {
        console.warn(`[iCal] Invalid date string: ${dateInput}, using current time as fallback`);
        return new Date();
      }
      return parsed;
    } catch (e: unknown) {
      console.error(`[iCal] Failed to parse date: ${dateInput}`, e);
      return new Date();
    }
  };
  
  // Get safe date objects
  const startDate = parseDate(schedule.startTime);
  const endDate = parseDate(schedule.endTime);
  
  // Convert timestamps to UTC for iCal format
  const startUTC = startDate.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/g, '');
  const endUTC = endDate.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/g, '');
  
  // Generate a unique ID for the event
  const eventUid = `DO-${schedule.id}-${confirmationCode}@dockoptimizer.com`;
  
  // Current timestamp for DTSTAMP
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/g, '');
  
  // Event status (CONFIRMED, CANCELLED, etc.)
  const status = cancelEvent ? 'CANCELLED' : 'CONFIRMED';
  
  // Build event description with all relevant details
  let description = `Dock Appointment #${confirmationCode}\\n`;
  description += `Facility: ${schedule.facilityName || 'Unknown'}\\n`;
  description += `Appointment Type: ${schedule.appointmentTypeName || 'Standard'}\\n`;
  
  if (schedule.dockName) {
    description += `Dock: ${schedule.dockName}\\n`;
  }
  
  if (schedule.carrierName) {
    description += `Carrier: ${schedule.carrierName}`;
    if (schedule.mcNumber) {
      description += ` (MC# ${schedule.mcNumber})`;
    }
    description += '\\n';
  }
  
  if (schedule.truckNumber) {
    description += `Truck #: ${schedule.truckNumber}\\n`;
  }
  
  if (schedule.trailerNumber) {
    description += `Trailer #: ${schedule.trailerNumber}\\n`;
  }
  
  if (schedule.driverName) {
    description += `Driver: ${schedule.driverName}\\n`;
  }
  
  if (schedule.notes) {
    description += `Notes: ${schedule.notes.replace(/\n/g, '\\n')}\\n`;
  }
  
  // Build the event summary
  const summary = `Dock Appointment at ${schedule.facilityName || 'Unknown Facility'}`;
  
  // Build the location
  const location = schedule.facilityName || 'Unknown Facility';
  
  // Build the iCal content
  let icalContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Dock Optimizer//Appointment Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${eventUid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${startUTC}`,
    `DTEND:${endUTC}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    `STATUS:${status}`,
    'SEQUENCE:0',
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
  
  return icalContent;
}

export async function sendEmail(params: EmailParams): Promise<{ html: string, text: string, attachments?: any[] } | boolean> {
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

  // Get the sender email, with validation and fallback
  let senderEmail = params.from || process.env.SENDGRID_FROM_EMAIL || 'notifications@dockoptimizer.com';
  
  // Validate the sender email with improved error handling
  if (!senderEmail) {
    console.error('No sender email specified - using default');
    senderEmail = 'notifications@dockoptimizer.com';
  } else if (senderEmail.startsWith('SG.')) {
    console.error('ERROR: SENDGRID_FROM_EMAIL appears to be an API key instead of an email address.');
    console.error('Please update your environment variables:');
    console.error('  SENDGRID_API_KEY: Should be your API key starting with "SG."');
    console.error('  SENDGRID_FROM_EMAIL: Should be a valid sender email (e.g., notifications@dockoptimizer.com)');
    senderEmail = 'notifications@dockoptimizer.com';
  } else if (!emailRegex.test(senderEmail)) {
    console.error(`Invalid sender email address format: "${senderEmail}"`);
    console.error('Email address must be in the format: name@domain.com');
    console.error('Using default sender email instead');
    senderEmail = 'notifications@dockoptimizer.com';
  } else {
    console.log(`Using sender email: ${senderEmail}`);
  }

  // Prepare the email message
  const msg: any = {
    to: params.to,
    from: senderEmail,
    subject: params.subject,
    text: params.text || 'No content provided',
    html: params.html || '<p>No content provided</p>',
  };
  
  // Add attachments if present
  if (params.attachments && params.attachments.length > 0) {
    msg.attachments = params.attachments;
  }

  // Skip email sending only if explicitly told to do so
  if (process.env.SKIP_EMAIL_SENDING === 'true') {
    console.log(`[DEV MODE] Email would be sent to: ${params.to} with subject: ${params.subject}`);
    console.log(`[DEV MODE] From: ${senderEmail}`);
    console.log('Email HTML preview:');
    console.log(msg.html.substring(0, 500) + (msg.html.length > 500 ? '...' : ''));
    
    // Log calendar attachment if present
    if (params.attachments && params.attachments.length > 0) {
      console.log('Email has calendar attachment:', params.attachments[0].filename);
    }
    
    return {
      html: msg.html,
      text: msg.text,
      attachments: params.attachments
    };
  }
  
  // Always log email attempt for debugging 
  console.log(`Attempting to send email to: ${params.to} with subject: ${params.subject}`);
  console.log(`From: ${senderEmail}`);

  // In production, attempt to send via SendGrid
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('SendGrid API key not set, skipping email send');
    return false;
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
): Promise<{ html: string, text: string, attachments?: any[] } | boolean> {
  // Safely get timezones with fallbacks
  const facilityTimezone = schedule.timezone || 'America/New_York';
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';

  // Log the timezones for debugging
  console.log(`[EMAIL] Using timezones: Facility=${facilityTimezone}, User=${userTimezone}`);
  console.log(`[EMAIL] Sending to: ${to}, confirmationCode: ${confirmationCode}`);
  console.log(`[EMAIL] Schedule: ID=${schedule.id}, facilityName=${schedule.facilityName}`);

  // Safely parse dates - handling both Date objects and string inputs
  const parseDate = (dateInput: Date | string | null): Date => {
    if (!dateInput) {
      console.warn('[EMAIL] Null date provided, using current time as fallback');
      return new Date();
    }
    
    // If it's already a Date object
    if (dateInput instanceof Date) {
      if (isNaN(dateInput.getTime())) {
        console.warn('[EMAIL] Invalid Date object provided, using current time as fallback');
        return new Date();
      }
      return dateInput;
    }
    
    // If it's a string, attempt to parse it
    try {
      const parsed = new Date(dateInput);
      if (isNaN(parsed.getTime())) {
        console.warn(`[EMAIL] Invalid date string: ${dateInput}, using current time as fallback`);
        return new Date();
      }
      return parsed;
    } catch (e: unknown) {
      console.error(`[EMAIL] Failed to parse date: ${dateInput}`, e);
      return new Date();
    }
  };

  // Get safe date objects
  const startDate = parseDate(schedule.startTime);
  const endDate = parseDate(schedule.endTime);
  
  // Log the original and parsed dates for debugging
  console.log(`[EMAIL] Original dates: Start=${JSON.stringify(schedule.startTime)}, End=${JSON.stringify(schedule.endTime)}`);
  console.log(`[EMAIL] Parsed dates: Start=${startDate.toISOString()}, End=${endDate.toISOString()}`);
  
  // Format times in facility timezone (location where appointment is scheduled)
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
  
  // Format times in user's local timezone
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

  // Get timezone abbreviations (EDT, PDT, etc.)
  const facilityTzAbbr = getTimezoneAbbr(facilityTimezone, startDate);
  const userTzAbbr = getTimezoneAbbr(userTimezone, startDate);
  
  // Log the formatted times for debugging
  console.log(`[EMAIL] Facility time: ${facilityStart} - ${facilityEnd} ${facilityTzAbbr}`);
  console.log(`[EMAIL] User time: ${userStart} - ${userEnd} ${userTzAbbr}`);

  // Create the final time strings for the email
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

  // Generate iCalendar file content
  const calendarEvent = generateICalEvent(schedule, confirmationCode);
  
  // Create email with calendar attachment
  return sendEmail({
    to,
    subject: `Dock Appointment Confirmation #${confirmationCode}`,
    html,
    text,
    attachments: [
      {
        content: Buffer.from(calendarEvent).toString('base64'),
        filename: `dock-appointment-${confirmationCode}.ics`,
        type: 'text/calendar',
        disposition: 'attachment'
      }
    ]
  });
}

/**
 * Send a reschedule notification email for a rescheduled appointment
 */
export async function sendRescheduleEmail(
  to: string,
  confirmationCode: string,
  schedule: EnhancedSchedule,
  oldStartTime?: Date,
  oldEndTime?: Date
): Promise<{ html: string, text: string, attachments?: any[] } | boolean> {
  // Safely get timezones with fallbacks
  const facilityTimezone = schedule.timezone || 'America/New_York';
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';

  // Safely parse dates
  const parseDate = (dateInput: Date | string | null): Date => {
    if (!dateInput) {
      return new Date();
    }
    
    if (dateInput instanceof Date) {
      if (isNaN(dateInput.getTime())) {
        return new Date();
      }
      return dateInput;
    }
    
    try {
      const parsed = new Date(dateInput);
      if (isNaN(parsed.getTime())) {
        return new Date();
      }
      return parsed;
    } catch (e: unknown) {
      return new Date();
    }
  };

  // Get safe date objects for new times
  const startDate = parseDate(schedule.startTime);
  const endDate = parseDate(schedule.endTime);
  
  // Format new times in facility timezone
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
  
  // Format new times in user's local timezone
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
  
  // Create the final time strings for the email
  const facilityTimeRange = `${facilityStart} - ${facilityEnd} ${facilityTzAbbr}`;
  const userTimeRange = `${userStart} - ${userEnd} ${userTzAbbr}`;

  // Format old times if provided, to show what changed
  let oldFacilityTimeRange = '';
  let oldUserTimeRange = '';
  
  if (oldStartTime && oldEndTime) {
    const oldStartDate = parseDate(oldStartTime);
    const oldEndDate = parseDate(oldEndTime);
    
    const oldFacilityStart = formatDateForTimezone(
      oldStartDate, 
      facilityTimezone, 
      'EEEE, MMMM d, yyyy h:mm aa'
    );
    const oldFacilityEnd = formatDateForTimezone(
      oldEndDate, 
      facilityTimezone, 
      'h:mm aa'
    );
    
    const oldUserStart = formatDateForTimezone(
      oldStartDate, 
      userTimezone, 
      'EEEE, MMMM d, yyyy h:mm aa'
    );
    const oldUserEnd = formatDateForTimezone(
      oldEndDate, 
      userTimezone, 
      'h:mm aa'
    );
    
    oldFacilityTimeRange = `${oldFacilityStart} - ${oldFacilityEnd} ${facilityTzAbbr}`;
    oldUserTimeRange = `${oldUserStart} - ${oldUserEnd} ${userTzAbbr}`;
  }

  // Host URL with potential fallback
  const host = process.env.HOST_URL || 'https://dockoptimizer.replit.app';

  // Create cancel link
  const cancelLink = `${host}/cancel?code=${confirmationCode}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #007bff; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0;">Appointment Rescheduled</h1>
        <p style="margin-top: 5px;">Confirmation #: ${confirmationCode}</p>
      </div>
      
      <div style="padding: 20px;">
        <p>Your dock appointment has been rescheduled. Please review the updated details below.</p>

        <div style="background-color: #f5f5f5; border-left: 4px solid #007bff; padding: 15px; margin: 20px 0;">
          <h2 style="margin-top: 0; color: #333;">Updated Appointment Details</h2>
          
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
            ${oldFacilityTimeRange ? `
            <tr>
              <td style="padding: 8px 0; color: #666;">Previous Time:</td>
              <td style="padding: 8px 0;"><span style="text-decoration: line-through;">${oldFacilityTimeRange}</span></td>
            </tr>` : ''}
            <tr>
              <td style="padding: 8px 0; color: #666;">New Facility Time:</td>
              <td style="padding: 8px 0;"><strong style="color: #007bff;">${facilityTimeRange}</strong></td>
            </tr>
            ${oldUserTimeRange ? `
            <tr>
              <td style="padding: 8px 0; color: #666;">Previous Local Time:</td>
              <td style="padding: 8px 0;"><span style="text-decoration: line-through;">${oldUserTimeRange}</span></td>
            </tr>` : ''}
            <tr>
              <td style="padding: 8px 0; color: #666;">New Local Time:</td>
              <td style="padding: 8px 0;"><strong style="color: #007bff;">${userTimeRange}</strong></td>
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
          </table>
        </div>
        
        <div style="margin: 30px 0; text-align: center;">
          <p style="margin-bottom: 15px;">Need to cancel this appointment?</p>
          
          <a href="${cancelLink}" 
             style="background-color: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Cancel Appointment
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
    APPOINTMENT RESCHEDULED
    Confirmation #: ${confirmationCode}
    
    Your dock appointment has been rescheduled. Please review the updated details below.
    
    UPDATED APPOINTMENT DETAILS
    ------------------
    Facility: ${schedule.facilityName || 'Unknown Facility'}
    Appointment: ${schedule.appointmentTypeName || 'Standard Appointment'}
    Dock: ${schedule.dockName || 'Not scheduled yet'}
    
    ${oldFacilityTimeRange ? `Previous Time: ${oldFacilityTimeRange}` : ''}
    New Facility Time: ${facilityTimeRange}
    ${oldUserTimeRange ? `Previous Local Time: ${oldUserTimeRange}` : ''}
    New Local Time: ${userTimeRange}
    ${schedule.driverName ? `Driver: ${schedule.driverName}` : ''}
    ${schedule.driverPhone ? `Driver Phone: ${schedule.driverPhone}` : ''}
    ${schedule.carrierId ? `Carrier: ${schedule.carrierName || 'Unknown Carrier'}` : ''}
    ${schedule.truckNumber ? `Truck #: ${schedule.truckNumber}` : ''}
    ${schedule.trailerNumber ? `Trailer #: ${schedule.trailerNumber}` : ''}
    
    Need to cancel? Visit: ${cancelLink}
    
    If you have any questions, please contact the facility directly.
    
    This is an automated message from Dock Optimizer. Please do not reply to this email.
  `;

  // Generate iCalendar file content for the updated appointment
  const calendarEvent = generateICalEvent(schedule, confirmationCode);
  
  // Create email with calendar attachment
  return sendEmail({
    to,
    subject: `Dock Appointment Rescheduled #${confirmationCode}`,
    html,
    text,
    attachments: [
      {
        content: Buffer.from(calendarEvent).toString('base64'),
        filename: `dock-appointment-${confirmationCode}.ics`,
        type: 'text/calendar',
        disposition: 'attachment'
      }
    ]
  });
}

/**
 * Send a cancellation email for a cancelled appointment
 */
export async function sendCancellationEmail(
  to: string,
  confirmationCode: string,
  schedule: EnhancedSchedule
): Promise<{ html: string, text: string, attachments?: any[] } | boolean> {
  // Safely get timezones with fallbacks
  const facilityTimezone = schedule.timezone || 'America/New_York';
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';

  // Safely parse dates
  const parseDate = (dateInput: Date | string | null): Date => {
    if (!dateInput) {
      return new Date();
    }
    
    if (dateInput instanceof Date) {
      if (isNaN(dateInput.getTime())) {
        return new Date();
      }
      return dateInput;
    }
    
    try {
      const parsed = new Date(dateInput);
      if (isNaN(parsed.getTime())) {
        return new Date();
      }
      return parsed;
    } catch (e: unknown) {
      return new Date();
    }
  };

  // Get safe date objects
  const startDate = parseDate(schedule.startTime);
  const endDate = parseDate(schedule.endTime);
  
  // Format times in facility timezone
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
  
  // Format times in user's local timezone
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
  
  // Create the final time strings for the email
  const facilityTimeRange = `${facilityStart} - ${facilityEnd} ${facilityTzAbbr}`;
  const userTimeRange = `${userStart} - ${userEnd} ${userTzAbbr}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #dc3545; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0;">Appointment Cancelled</h1>
        <p style="margin-top: 5px;">Confirmation #: ${confirmationCode}</p>
      </div>
      
      <div style="padding: 20px;">
        <p>Your dock appointment has been cancelled. Below are the details of the cancelled appointment.</p>

        <div style="background-color: #f5f5f5; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0;">
          <h2 style="margin-top: 0; color: #333;">Cancelled Appointment Details</h2>
          
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
              <td style="padding: 8px 0; color: #666;">Scheduled Facility Time:</td>
              <td style="padding: 8px 0;"><span style="text-decoration: line-through;">${facilityTimeRange}</span></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Scheduled Local Time:</td>
              <td style="padding: 8px 0;"><span style="text-decoration: line-through;">${userTimeRange}</span></td>
            </tr>
            ${schedule.driverName ? `
            <tr>
              <td style="padding: 8px 0; color: #666;">Driver:</td>
              <td style="padding: 8px 0;"><strong>${schedule.driverName}</strong></td>
            </tr>` : ''}
            ${schedule.carrierId ? `
            <tr>
              <td style="padding: 8px 0; color: #666;">Carrier:</td>
              <td style="padding: 8px 0;"><strong>${schedule.carrierName || 'Unknown Carrier'}</strong></td>
            </tr>` : ''}
          </table>
        </div>
        
        <p>If you need to schedule a new appointment, please visit our booking portal or contact the facility directly.</p>
      </div>
      
      <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
        <p>This is an automated message from Dock Optimizer. Please do not reply to this email.</p>
      </div>
    </div>
  `;

  const text = `
    APPOINTMENT CANCELLED
    Confirmation #: ${confirmationCode}
    
    Your dock appointment has been cancelled. Below are the details of the cancelled appointment.
    
    CANCELLED APPOINTMENT DETAILS
    ------------------
    Facility: ${schedule.facilityName || 'Unknown Facility'}
    Appointment: ${schedule.appointmentTypeName || 'Standard Appointment'}
    Scheduled Facility Time: ${facilityTimeRange} (CANCELLED)
    Scheduled Local Time: ${userTimeRange} (CANCELLED)
    ${schedule.driverName ? `Driver: ${schedule.driverName}` : ''}
    ${schedule.carrierId ? `Carrier: ${schedule.carrierName || 'Unknown Carrier'}` : ''}
    
    If you need to schedule a new appointment, please visit our booking portal or contact the facility directly.
    
    This is an automated message from Dock Optimizer. Please do not reply to this email.
  `;

  // Generate iCalendar file content for the cancelled appointment
  const calendarEvent = generateICalEvent(schedule, confirmationCode, true);
  
  // Create email with calendar attachment (cancelled status)
  return sendEmail({
    to,
    subject: `Dock Appointment Cancelled #${confirmationCode}`,
    html,
    text,
    attachments: [
      {
        content: Buffer.from(calendarEvent).toString('base64'),
        filename: `dock-appointment-${confirmationCode}-cancelled.ics`,
        type: 'text/calendar',
        disposition: 'attachment'
      }
    ]
  });
}

/**
 * Send a reminder email for an upcoming appointment
 */
export async function sendReminderEmail(
  to: string,
  confirmationCode: string,
  schedule: EnhancedSchedule,
  hoursUntilAppointment: number
): Promise<{ html: string, text: string, attachments?: any[] } | boolean> {
  // Safely get timezones with fallbacks
  const facilityTimezone = schedule.timezone || 'America/New_York';
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';

  // Safely parse dates
  const parseDate = (dateInput: Date | string | null): Date => {
    if (!dateInput) {
      return new Date();
    }
    
    if (dateInput instanceof Date) {
      if (isNaN(dateInput.getTime())) {
        return new Date();
      }
      return dateInput;
    }
    
    try {
      const parsed = new Date(dateInput);
      if (isNaN(parsed.getTime())) {
        return new Date();
      }
      return parsed;
    } catch (e: unknown) {
      return new Date();
    }
  };

  // Get safe date objects
  const startDate = parseDate(schedule.startTime);
  const endDate = parseDate(schedule.endTime);
  
  // Format times in facility timezone
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
  
  // Format times in user's local timezone
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
  
  // Create the final time strings for the email
  const facilityTimeRange = `${facilityStart} - ${facilityEnd} ${facilityTzAbbr}`;
  const userTimeRange = `${userStart} - ${userEnd} ${userTzAbbr}`;

  // Host URL with potential fallback
  const host = process.env.HOST_URL || 'https://dockoptimizer.replit.app';

  // Create reschedule/cancel links
  const rescheduleLink = `${host}/reschedule?code=${confirmationCode}`;
  const cancelLink = `${host}/cancel?code=${confirmationCode}`;

  // Set reminder text based on hours until appointment
  let reminderText = '';
  if (hoursUntilAppointment <= 1) {
    reminderText = 'Your appointment is coming up in less than an hour!';
  } else if (hoursUntilAppointment <= 2) {
    reminderText = 'Your appointment is coming up in less than 2 hours.';
  } else if (hoursUntilAppointment <= 4) {
    reminderText = 'Your appointment is coming up in less than 4 hours.';
  } else if (hoursUntilAppointment <= 24) {
    reminderText = 'Your appointment is scheduled for tomorrow.';
  } else {
    reminderText = `Your appointment is scheduled in ${Math.round(hoursUntilAppointment / 24)} days.`;
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #ffc107; color: #212529; padding: 20px; text-align: center;">
        <h1 style="margin: 0;">Appointment Reminder</h1>
        <p style="margin-top: 5px;">Confirmation #: ${confirmationCode}</p>
      </div>
      
      <div style="padding: 20px;">
        <p><strong>${reminderText}</strong> Please review your appointment details below.</p>

        <div style="background-color: #f5f5f5; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
          <h2 style="margin-top: 0; color: #333;">Upcoming Appointment</h2>
          
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
          </table>
        </div>
        
        <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #856404;">Important Reminders</h3>
          <ul style="margin-top: 10px; padding-left: 20px;">
            <li>Please arrive 15 minutes before your scheduled time.</li>
            <li>Have your confirmation number and all required documentation ready.</li>
            <li>Follow all facility safety guidelines and instructions.</li>
          </ul>
        </div>
        
        ${hoursUntilAppointment > 2 ? `
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
        </div>` : ''}
        
        <p>If you have any questions, please contact the facility directly.</p>
      </div>
      
      <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
        <p>This is an automated message from Dock Optimizer. Please do not reply to this email.</p>
      </div>
    </div>
  `;

  const text = `
    APPOINTMENT REMINDER
    Confirmation #: ${confirmationCode}
    
    ${reminderText} Please review your appointment details below.
    
    UPCOMING APPOINTMENT
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
    
    IMPORTANT REMINDERS:
    - Please arrive 15 minutes before your scheduled time.
    - Have your confirmation number and all required documentation ready.
    - Follow all facility safety guidelines and instructions.
    
    ${hoursUntilAppointment > 2 ? `Need to make changes? 
    Reschedule: ${rescheduleLink}
    Cancel: ${cancelLink}` : ''}
    
    If you have any questions, please contact the facility directly.
    
    This is an automated message from Dock Optimizer. Please do not reply to this email.
  `;

  // Generate iCalendar file content for the appointment reminder
  const calendarEvent = generateICalEvent(schedule, confirmationCode);
  
  // Create email with calendar attachment
  return sendEmail({
    to,
    subject: `Reminder: Upcoming Dock Appointment #${confirmationCode}`,
    html,
    text,
    attachments: [
      {
        content: Buffer.from(calendarEvent).toString('base64'),
        filename: `dock-appointment-${confirmationCode}.ics`,
        type: 'text/calendar',
        disposition: 'attachment'
      }
    ]
  });
}