import sgMail from '@sendgrid/mail';
import { Schedule } from '../shared/schema';
import { format } from 'date-fns';
import { formatToTimeZone, parseFromTimeZone } from 'date-fns-timezone';

// Enhanced schedule with UI-specific fields
export interface EnhancedSchedule extends Schedule {
  facilityId?: number;
  facilityName?: string;
  appointmentTypeName?: string;
  dockName?: string;
  timezone?: string;
  carrierName?: string;
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

export async function sendEmail(params: EmailParams): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('SendGrid API key not set, skipping email send');
    return false;
  }

  try {
    const msg = {
      to: params.to,
      from: params.from || 'notifications@dockoptimizer.com',
      subject: params.subject,
      text: params.text || '',
      html: params.html || '',
    };

    await sgMail.send(msg);
    console.log(`Email sent successfully to ${params.to}`);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

/**
 * Format a date for a specific timezone
 */
function formatDateForTimezone(date: Date, timezone: string, formatStr: string): string {
  try {
    return formatToTimeZone(date, formatStr, { timeZone: timezone });
  } catch (error) {
    console.error(`Error formatting date for timezone ${timezone}:`, error);
    // Fallback to simple format if timezone formatting fails
    return format(date, formatStr);
  }
}

/**
 * Get the abbreviated timezone name
 */
function getTimezoneAbbr(timezone: string, date: Date): string {
  try {
    // This will return something like "EST" or "EDT" depending on daylight saving time
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short'
    }).formatToParts(date)
      .find(part => part.type === 'timeZoneName');
    
    return parts?.value || timezone.split('/').pop() || 'GMT';
  } catch (error) {
    console.error(`Error getting timezone abbreviation for ${timezone}:`, error);
    return timezone.split('/').pop() || 'GMT';
  }
}

/**
 * Send a confirmation email for a new or rescheduled appointment
 */
export async function sendConfirmationEmail(
  to: string,
  confirmationCode: string,
  schedule: EnhancedSchedule
): Promise<boolean> {
  const facilityTimezone = schedule.timezone || 'America/New_York';
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';

  // Format times in both facility and user timezone
  const facilityStart = formatDateForTimezone(
    new Date(schedule.startTime), 
    facilityTimezone, 
    'EEEE, MMMM d, yyyy h:mm aa'
  );
  const facilityEnd = formatDateForTimezone(
    new Date(schedule.endTime), 
    facilityTimezone, 
    'h:mm aa'
  );
  const userStart = formatDateForTimezone(
    new Date(schedule.startTime), 
    userTimezone, 
    'EEEE, MMMM d, yyyy h:mm aa'
  );
  const userEnd = formatDateForTimezone(
    new Date(schedule.endTime), 
    userTimezone, 
    'h:mm aa'
  );

  // Get timezone abbreviations
  const facilityTzAbbr = getTimezoneAbbr(facilityTimezone, new Date(schedule.startTime));
  const userTzAbbr = getTimezoneAbbr(userTimezone, new Date(schedule.startTime));

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