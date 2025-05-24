import sgMail from '@sendgrid/mail';
import { Schedule } from '../shared/schema';
import { format } from 'date-fns';
import { formatToTimeZone, parseFromTimeZone } from 'date-fns-timezone';
// Use existing QR code generation function from the server
import { generateQRCodeSVG as generateQRCode } from './endpoints/qr-codes';

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
  creatorEmail?: string;  // Email of the person who created the appointment
  confirmationCode?: string; // Standardized confirmation code format
  
  // BOL-related properties
  bolData?: any; // OCR extracted data from BOL document
  bolFileUploaded?: boolean; // Whether a BOL file was uploaded
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

import logger from './logger';
import fs from 'fs';
import path from 'path';

// Create email logs directory if it doesn't exist
const EMAIL_DEBUG = process.env.DEBUG_EMAILS === 'true';
const logsDir = path.join(process.cwd(), 'logs', 'emails');
if (EMAIL_DEBUG && !fs.existsSync(logsDir)) {
  try {
    fs.mkdirSync(logsDir, { recursive: true });
    logger.info('EmailService', `Created email logs directory at ${logsDir}`);
  } catch (error) {
    logger.error('EmailService', 'Failed to create email logs directory', error);
  }
}

export async function sendEmail(params: EmailParams): Promise<{ html: string, text: string, attachments?: any[] } | boolean> {
  // Check for required email module
  const isEmailModuleEnabled = !process.env.DISABLE_EMAIL_NOTIFICATIONS;
  if (!isEmailModuleEnabled) {
    logger.warn('EmailService', 'Email notifications are disabled by system configuration');
    return false;
  }

  if (!params.to || !params.subject) {
    logger.error('EmailService', 'Missing required email parameters (to, subject)', null, { 
      providedParams: Object.keys(params)
    });
    return false;
  }

  // Validate email address format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(params.to)) {
    logger.error('EmailService', `Invalid email address format: ${params.to}`);
    return false;
  }

  // Get the sender email, with validation and fallback
  let senderEmail = params.from || process.env.SENDGRID_FROM_EMAIL || 'notifications@dockoptimizer.com';
  
  // Validate the sender email with improved error handling
  if (!senderEmail) {
    logger.warn('EmailService', 'No sender email specified - using default');
    senderEmail = 'notifications@dockoptimizer.com';
  } else if (senderEmail.startsWith('SG.')) {
    logger.error('EmailService', 'SENDGRID_FROM_EMAIL appears to be an API key instead of an email address', null, {
      action: "Please update your environment variables: SENDGRID_API_KEY should be your API key starting with 'SG.' and SENDGRID_FROM_EMAIL should be a valid sender email"
    });
    senderEmail = 'notifications@dockoptimizer.com';
  } else if (!emailRegex.test(senderEmail)) {
    logger.error('EmailService', `Invalid sender email address format: "${senderEmail}"`, null, {
      message: 'Email address must be in the format: name@domain.com'
    });
    senderEmail = 'notifications@dockoptimizer.com';
  } else {
    logger.debug('EmailService', `Using sender email: ${senderEmail}`);
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
    logger.debug('EmailService', `Including ${params.attachments.length} attachment(s)`);
  }

  // Write email content to file for debugging if enabled
  if (EMAIL_DEBUG) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const emailId = `email_${timestamp}_${Math.floor(Math.random() * 10000)}`;
      const emailLogPath = path.join(logsDir, `${emailId}.txt`);
      const htmlLogPath = path.join(logsDir, `${emailId}.html`);
      
      // Write metadata and text content
      const metadataContent = `
To: ${msg.to}
From: ${msg.from}
Subject: ${msg.subject}
Date: ${new Date().toISOString()}
Has Attachments: ${!!msg.attachments}
Attachment Count: ${msg.attachments?.length || 0}

--- TEXT CONTENT ---
${msg.text}
`;
      fs.writeFileSync(emailLogPath, metadataContent);
      
      // Write HTML content separately
      fs.writeFileSync(htmlLogPath, msg.html);
      
      logger.info('EmailService', `Email debug files written to ${emailLogPath} and ${htmlLogPath}`);
    } catch (debugError) {
      logger.error('EmailService', 'Failed to write email debug files', debugError);
    }
  }

  // Skip email sending only if explicitly told to do so
  if (process.env.SKIP_EMAIL_SENDING === 'true') {
    logger.info('EmailService', `[DEV MODE] Email would be sent to: ${params.to}`, {
      subject: params.subject,
      from: senderEmail,
      previewLength: msg.html.length,
      hasAttachments: !!params.attachments?.length
    });
    
    return {
      html: msg.html,
      text: msg.text,
      attachments: params.attachments
    };
  }
  
  // Always log email attempt for debugging 
  logger.info('EmailService', `Attempting to send email to: ${params.to}`, {
    subject: params.subject,
    from: senderEmail
  });

  // Check if we have a valid SendGrid API key
  if (!process.env.SENDGRID_API_KEY) {
    logger.error('EmailService', 'SendGrid API key not set, skipping email send', null, {
      action: "Add the SENDGRID_API_KEY to your environment variables"
    });
    return false;
  }

  // Check if the API key looks valid (basic format check)
  if (!process.env.SENDGRID_API_KEY.startsWith('SG.')) {
    logger.error('EmailService', 'Invalid SendGrid API key format', null, {
      message: "The API key should start with 'SG.'"
    });
    return false;
  }

  try {
    // First attempt
    logger.debug('EmailService', 'Sending email via SendGrid (attempt 1)');
    await sgMail.send(msg);
    logger.info('EmailService', `Email sent successfully to ${params.to}`);
    return true;
  } catch (error: unknown) {
    logger.warn('EmailService', 'First attempt to send email failed, retrying once...', error);
    
    // Extract specific SendGrid error details if available
    if (error && typeof error === 'object' && 'response' in error && error.response && typeof error.response === 'object' && 'body' in error.response) {
      logger.error('EmailService', 'SendGrid API error details (first attempt)', null, {
        responseBody: error.response.body
      });
    }
    
    // Try one more time after a brief delay
    try {
      // Wait 1 second before retry
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      logger.debug('EmailService', 'Sending email via SendGrid (attempt 2)');
      await sgMail.send(msg);
      logger.info('EmailService', `Email sent successfully on retry to ${params.to}`);
      return true;
    } catch (retryError: unknown) {
      logger.error('EmailService', 'Error sending email via SendGrid (both attempts failed)', retryError);
      
      // Extract specific SendGrid error details if available
      if (retryError && typeof retryError === 'object' && 'response' in retryError && retryError.response && typeof retryError.response === 'object' && 'body' in retryError.response) {
        logger.error('EmailService', 'SendGrid API error details (retry attempt)', null, {
          responseBody: retryError.response.body
        });
      }
      
      return false;
    }
  }
}

/**
 * Format a date for a specific timezone with enhanced error handling and debugging
 */
function formatDateForTimezone(date: Date, timezone: string, formatStr: string): string {
  try {
    console.log(`[EMAIL] Formatting date: ${date} for timezone: ${timezone} with format: ${formatStr}`);
    
    // Check if date is valid before proceeding
    if (!(date instanceof Date)) {
      console.warn(`[EMAIL] Non-Date object provided to formatDateForTimezone: ${date} (type: ${typeof date})`);
      // Return current date/time as fallback
      const now = new Date();
      console.log(`[EMAIL] Using fallback current date: ${now.toISOString()}`);
      return formatToTimeZone(now, formatStr, { timeZone: timezone });
    }
    
    if (isNaN(date.getTime())) {
      console.warn(`[EMAIL] Invalid Date object provided to formatDateForTimezone: ${date}`);
      // Return current date/time as fallback
      const now = new Date();
      console.log(`[EMAIL] Using fallback current date: ${now.toISOString()}`);
      return formatToTimeZone(now, formatStr, { timeZone: timezone });
    }
    
    // Create a safe copy of the date
    const safeDate = new Date(date.getTime());
    console.log(`[EMAIL] Using safe date copy: ${safeDate.toISOString()} for timezone: ${timezone}`);
    
    // Make sure the format string is correct (replace 'yyyy' with actual year format token)
    // The issue is sometimes 'yyyy' is showing up literally instead of being replaced with the year
    if (formatStr.includes('yyyy')) {
      try {
        // Directly create date components to ensure correct formatting
        const year = safeDate.getFullYear();
        const month = formatToTimeZone(safeDate, 'MMMM', { timeZone: timezone });
        const dayOfWeek = formatToTimeZone(safeDate, 'EEEE', { timeZone: timezone });
        const dayOfMonth = formatToTimeZone(safeDate, 'd', { timeZone: timezone });
        const time = formatToTimeZone(safeDate, 'h:mm a', { timeZone: timezone });
        
        // Construct the full date string manually
        const finalResult = formatStr.includes('EEEE') 
          ? `${dayOfWeek}, ${month} ${dayOfMonth}, ${year} ${time}`
          : `${month} ${dayOfMonth}, ${year} ${time}`;
        
        console.log(`[EMAIL] Formatted with manual date components: ${finalResult}`);
        return finalResult;
      } catch (tzError) {
        console.error(`[EMAIL] Error with timezone formatting: ${tzError}`);
        // Fallback to basic date format without timezone
        const basicFormatted = format(safeDate, 'EEEE, MMMM d, yyyy h:mm a');
        console.log(`[EMAIL] Basic formatted result: ${basicFormatted}`);
        return basicFormatted;
      }
    }
    
    // Standard formatting path without year issues
    const formattedResult = formatToTimeZone(safeDate, formatStr, { timeZone: timezone });
    console.log(`[EMAIL] Formatted result: ${formattedResult}`);
    return formattedResult;
  } catch (error) {
    console.error(`[EMAIL] Error formatting date for timezone ${timezone}:`, error);
    
    // Fallback to simple format if timezone formatting fails
    try {
      console.log(`[EMAIL] Attempting fallback formatting without timezone`);
      // For this fallback, explicitly use a format that works with standard date-fns
      const fallbackFormatStr = formatStr
        .replace('yyyy', 'yyyy')
        .replace('EEEE', 'EEEE')
        .replace('MMMM', 'MMMM')
        .replace('aa', 'a');
      return format(date, fallbackFormatStr);
    } catch (fallbackError) {
      console.error('[EMAIL] Fallback formatting also failed:', fallbackError);
      
      // Ultimate fallback - manual formatting to ensure year is correct
      try {
        const d = date instanceof Date ? date : new Date();
        return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
      } catch (finalError) {
        // Last resort
        return new Date().toLocaleString();
      }
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
 * Generate a QR code for appointment check-in that works in email clients
 */
// Use the QRCode library directly to generate inline base64 QR codes for emails
import QRCode from 'qrcode';

// We need to make this async since QR code generation is async
async function generateQRCodeBase64(data: string): Promise<string> {
  try {
    // Options for QR code generation - use proper type
    const options = {
      errorCorrectionLevel: 'H' as const,
      type: 'image/png' as const,
      margin: 1,
      width: 150,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    };
    
    // Generate a base64-encoded PNG image
    const qrCodeBase64 = await QRCode.toDataURL(data, options);
    return qrCodeBase64;
  } catch (error) {
    console.error('Error generating QR code as base64:', error);
    // Return an empty transparent PNG if there's an error
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  }
}

/**
 * Generate a QR code for appointment check-in that works reliably in email clients
 * This implementation uses an SVG QR code or an image URL depending on the email client
 */
async function generateQRCodeSVG(confirmationCode: string, baseUrl: string): Promise<string> {
  // Create the check-in URL that will be encoded in the QR code
  const checkInUrl = `${baseUrl}/driver-check-in?code=${confirmationCode}`;
  // Create a direct URL to the QR code endpoint for email clients that can't render SVG
  const qrCodeUrl = `${baseUrl}/api/qr-code/${encodeURIComponent(confirmationCode)}`;
  
  // Create a debug log
  console.log(`[QR-CODE] Generating QR code for confirmation code ${confirmationCode}`);
  console.log(`[QR-CODE] Check-in URL: ${checkInUrl}`);
  console.log(`[QR-CODE] Image URL fallback: ${qrCodeUrl}`);
  
  try {
    // Try to generate an SVG QR code for better email client compatibility
    const svgString = await QRCode.toString(checkInUrl, {
      type: 'svg',
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 150
    });
    
    // Log the first part of the SVG for debugging
    console.log(`[QR-CODE] Generated SVG QR code (first 100 chars): ${svgString.substring(0, 100)}...`);
    
    // For maximum compatibility, we'll offer both an SVG and an image URL
    return `
      <div style="text-align: center; margin: 15px auto; background-color: #f0f9ff; padding: 15px; border-radius: 8px; border: 1px solid #b3d7ff; max-width: 320px;">
        <h3 style="color: #0066cc; margin-top: 0; text-align: center;">Express Check-In QR Code</h3>
        <div style="background-color: white; padding: 10px; border-radius: 5px; display: inline-block; margin-bottom: 10px; border: 1px solid #b3d7ff;">
          <!-- Embedded SVG QR code for email clients that support it -->
          ${svgString.replace(/width="[^"]*"/, 'width="150"').replace(/height="[^"]*"/, 'height="150"')}
          
          <!-- Fallback to image URL for clients that don't support inline SVG -->
          <!--[if mso]>
          <img src="${qrCodeUrl}" 
               alt="Check-in QR Code" 
               width="150" height="150"
               style="display: block; margin: 0 auto;">
          <![endif]-->
          
          <p style="margin: 5px 0 0; font-family: monospace; font-weight: bold; color: #0066cc; text-align: center; font-size: 16px;">
            ${confirmationCode}
          </p>
        </div>
        <div style="font-size: 13px; color: #333; text-align: left; margin-top: 10px;">
          <p style="margin: 0 0 5px; font-weight: bold;">How to use:</p>
          <ul style="margin: 0; padding-left: 20px;">
            <li>Present this QR code to dock staff upon arrival</li>
            <li>You can also scan it yourself to check in quickly</li>
            <li>If you can't see the QR code above, use your confirmation code: <strong>${confirmationCode}</strong></li>
            <li>Or open this link directly: <a href="${checkInUrl}" style="color: #0066cc;">${checkInUrl}</a></li>
          </ul>
        </div>
      </div>
    `;
  } catch (error) {
    console.error('[QR-CODE] Error generating SVG QR code:', error);
    
    // Fallback to just using an image URL if SVG generation fails
    return `
      <div style="text-align: center; margin: 15px auto; background-color: #f0f9ff; padding: 15px; border-radius: 8px; border: 1px solid #b3d7ff; max-width: 320px;">
        <h3 style="color: #0066cc; margin-top: 0; text-align: center;">Express Check-In QR Code</h3>
        <div style="background-color: white; padding: 10px; border-radius: 5px; display: inline-block; margin-bottom: 10px; border: 1px solid #b3d7ff;">
          <img src="${qrCodeUrl}" 
               alt="Check-in QR Code" 
               width="150" height="150"
               style="display: block; margin: 0 auto;">
          <p style="margin: 5px 0 0; font-family: monospace; font-weight: bold; color: #0066cc; text-align: center; font-size: 16px;">
            ${confirmationCode}
          </p>
        </div>
        <div style="font-size: 13px; color: #333; text-align: left; margin-top: 10px;">
          <p style="margin: 0 0 5px; font-weight: bold;">How to use:</p>
          <ul style="margin: 0; padding-left: 20px;">
            <li>Present this QR code to dock staff upon arrival</li>
            <li>You can also scan it yourself to check in quickly</li>
            <li>If you can't see the QR code above, use your confirmation code: <strong>${confirmationCode}</strong></li>
            <li>Or open this link directly: <a href="${checkInUrl}" style="color: #0066cc;">${checkInUrl}</a></li>
          </ul>
        </div>
      </div>
    `;
  }
}

/**
 * Send a confirmation email for a new or rescheduled appointment
 */
/**
 * Resend a confirmation email for an existing appointment
 * This function is used when the user requests an email resend from the confirmation page
 * or wants to send the confirmation to an additional email address
 */
export async function resendConfirmationEmail(
  to: string,
  confirmationCode: string,
  scheduleId: number
): Promise<boolean> {
  try {
    console.log(`[Email] Attempting to resend confirmation email for schedule #${scheduleId} to ${to}`);
    
    // Fetch the appointment details to get the latest data
    const db = require('./db').db;
    const { schedules, facilities, appointmentTypes } = require('../shared/schema');
    const { eq } = require('drizzle-orm');
    
    // Get the schedule with related data
    const scheduleData = await db.query.schedules.findFirst({
      where: eq(schedules.id, scheduleId),
      with: {
        facility: true,
        appointmentType: true,
        dock: true
      }
    });
    
    if (!scheduleData) {
      console.error(`[Email] Cannot resend confirmation - Schedule #${scheduleId} not found`);
      return false;
    }
    
    // Convert to EnhancedSchedule format
    const schedule = {
      ...scheduleData,
      facilityName: scheduleData.facility?.name || 'Main Facility',
      appointmentTypeName: scheduleData.appointmentType?.name || 'Standard Appointment',
      dockName: scheduleData.dock?.name || 'Not assigned',
      timezone: scheduleData.facility?.timezone || 'America/New_York',
      confirmationCode: confirmationCode
    };
    
    // Send the confirmation email
    const emailResult = await sendConfirmationEmail(to, confirmationCode, schedule);
    // Return true if email was sent successfully (could be either a boolean or email details)
    return emailResult !== false;
  } catch (error) {
    console.error('[Email] Error resending confirmation email:', error);
    return false;
  }
}

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

  // Safely parse dates with enhanced debugging
  const parseDate = (dateInput: Date | string | null): Date => {
    console.log(`[EMAIL] Parsing date input: ${dateInput} (type: ${typeof dateInput})`);
    
    if (!dateInput) {
      console.warn('[EMAIL] No date input provided, using current date as fallback');
      const now = new Date();
      console.log(`[EMAIL] Created fallback date: ${now.toISOString()}`);
      return now;
    }
    
    if (dateInput instanceof Date) {
      const isValidDate = !isNaN(dateInput.getTime());
      console.log(`[EMAIL] Input is Date object, valid: ${isValidDate}, value: ${isValidDate ? dateInput.toISOString() : 'INVALID'}`);
      if (!isValidDate) {
        console.warn('[EMAIL] Invalid Date object received, using current date as fallback');
        const now = new Date();
        console.log(`[EMAIL] Created fallback date: ${now.toISOString()}`);
        return now;
      }
      return dateInput;
    }
    
    try {
      // If string is ISO format, parse directly
      const trimmedInput = typeof dateInput === 'string' ? dateInput.trim() : String(dateInput);
      console.log(`[EMAIL] Attempting to parse string: "${trimmedInput}"`);
      
      // Handle various possible date formats
      let parsed: Date;
      
      // Try ISO format first
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(trimmedInput)) {
        console.log(`[EMAIL] Detected ISO format, parsing directly`);
        parsed = new Date(trimmedInput);
      } 
      // Try timestamp format (all digits)
      else if (/^\d+$/.test(trimmedInput)) {
        console.log(`[EMAIL] Detected timestamp format, parsing as number`);
        parsed = new Date(parseInt(trimmedInput, 10));
      }
      // Default parse attempt
      else {
        console.log(`[EMAIL] Using default Date constructor for parsing`);
        parsed = new Date(trimmedInput);
      }
      
      const isValidParsed = !isNaN(parsed.getTime());
      console.log(`[EMAIL] Parsed result: ${isValidParsed ? parsed.toISOString() : 'INVALID'}`);
      
      if (!isValidParsed) {
        console.warn(`[EMAIL] Failed to parse date from string: "${trimmedInput}", using current date as fallback`);
        const now = new Date();
        console.log(`[EMAIL] Created fallback date: ${now.toISOString()}`);
        return now;
      }
      return parsed;
    } catch (e: unknown) {
      console.error(`[EMAIL] Exception while parsing date: ${e}`, e);
      const now = new Date();
      console.log(`[EMAIL] Created fallback date after exception: ${now.toISOString()}`);
      return now;
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
  
  // Generate QR code SVG directly instead of using URLs
  const checkInUrl = `${host}/driver-check-in?code=${encodeURIComponent(confirmationCode)}`;
  // Generate QR code SVG content with all HTML styling included
  const qrCodeSvgContent = await generateQRCodeSVG(confirmationCode, host);
  console.log(`[EMAIL] Generated QR code SVG for confirmation email to ${to}`);
  
  
  // Additional logging to help debug QR code issues
  console.log(`[EMAIL] Full check-in URL: ${checkInUrl}`);
  console.log(`[EMAIL] Host URL from env or default: ${host}`);

  // Generate QR code SVG directly
  
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
            ${schedule.bolNumber ? `
            <tr>
              <td style="padding: 8px 0; color: #666;">BOL #:</td>
              <td style="padding: 8px 0;"><strong>${schedule.bolNumber}</strong></td>
            </tr>` : ''}
            ${schedule.bolFileUploaded ? `
            <tr>
              <td style="padding: 8px 0; color: #666;">BOL Document:</td>
              <td style="padding: 8px 0;"><strong style="color: #22c55e;">✓ Uploaded</strong></td>
            </tr>` : ''}
          </table>
        </div>
        
        <!-- Insert the generated QR code SVG content directly -->
        ${qrCodeSvgContent}
            
            <p style="margin-top: 10px; margin-bottom: 0; font-size: 12px; color: #666;">
              Confirmation Code: ${confirmationCode}<br>
              <span style="font-size: 11px;">Scan with your phone to check in</span>
            </p>
          </div>
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
    ${schedule.bolNumber ? `BOL #: ${schedule.bolNumber}` : ''}
    ${schedule.bolFileUploaded ? `BOL Document: Uploaded` : ''}
    
    CHECK-IN INFORMATION
    ------------------
    Confirmation Code: ${confirmationCode}
    Express Check-in URL: ${checkInUrl}
    
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

  // Generate QR code URLs
  const checkInUrl = `${host}/driver-check-in?code=${encodeURIComponent(confirmationCode)}`;
  // Generate QR code SVG directly
  const qrCodeSvgContent = await generateQRCodeSVG(confirmationCode, host);
  console.log(`[EMAIL] Generated QR code SVG for reschedule email to ${to}`);
  
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
        
        <!-- Enhanced Quick check-in QR code section with SVG and fallback image -->
        <div style="text-align: center; margin: 25px 0;">
          <div style="display: inline-block; background-color: white; padding: 15px; border: 1px solid #ddd; border-radius: 5px;">
            <h3 style="margin-top: 0; margin-bottom: 10px; color: #333;">Express Check-in</h3>
            
            <!-- SVG QR code for modern email clients -->
            ${qrCodeSvgContent}
            
            <p style="margin-top: 10px; margin-bottom: 0; font-size: 12px; color: #666;">
              Confirmation Code: ${confirmationCode}<br>
              <span style="font-size: 11px;">Scan with your phone to check in</span>
            </p>
          </div>
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
  
  // Generate QR code and check-in URL
  const checkInUrl = `${host}/driver-check-in?code=${encodeURIComponent(confirmationCode)}`;
  
  // Generate QR code SVG directly
  const qrCodeSvgContent = await generateQRCodeSVG(confirmationCode, host);
  console.log(`[EMAIL] Generated QR code SVG for reminder email to ${to}`);

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
        
        <!-- Enhanced Quick check-in QR code section with SVG and fallback image -->
        <div style="text-align: center; margin: 25px 0;">
          <div style="display: inline-block; background-color: white; padding: 15px; border: 1px solid #ddd; border-radius: 5px;">
            <h3 style="margin-top: 0; margin-bottom: 10px; color: #333;">Express Check-in</h3>
            
            <!-- SVG QR code for modern email clients -->
            ${qrCodeSvgContent}
            
            <p style="margin-top: 10px; margin-bottom: 0; font-size: 12px; color: #666;">
              Confirmation Code: ${confirmationCode}<br>
              <span style="font-size: 11px;">Scan with your phone to check in</span>
            </p>
          </div>
        </div>
        
        <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #856404;">Important Reminders</h3>
          <ul style="margin-top: 10px; padding-left: 20px;">
            <li>Please arrive 15 minutes before your scheduled time.</li>
            <li>Have your confirmation number and all required documentation ready.</li>
            <li>Follow all facility safety guidelines and instructions.</li>
            <li>Use the QR code above for express check-in upon arrival.</li>
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
    - Have your confirmation number (${confirmationCode}) and all required documentation ready.
    - Follow all facility safety guidelines and instructions.
    - Use the QR code from the HTML email or your confirmation code for express check-in.
    
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