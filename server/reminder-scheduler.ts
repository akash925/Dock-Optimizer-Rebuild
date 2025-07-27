/**
 * Email Reminder Scheduler
 * 
 * This module runs a scheduler to automatically send reminder emails for upcoming appointments
 * based on the emailReminderTime setting in each appointment type.
 */

import { getStorage } from './storage';
import { sendReminderEmail } from './notifications';
import { Schedule, AppointmentType } from '@shared/schema';

// Define the EnhancedSchedule type since it's not exported from schema
interface EnhancedSchedule extends Schedule {
  appointmentType: string;
  facilityName: string;
  timezone: string;
  dockName: string;
}
import { differenceInHours } from 'date-fns';

// Track the reminder status to avoid sending duplicates
const sentReminders = new Map<number, boolean>();

/**
 * Check if a reminder needs to be sent for a given schedule
 * @param schedule The appointment schedule
 * @param appointmentType The appointment type with reminder settings
 * @returns True if a reminder should be sent, false otherwise
 */
function shouldSendReminder(
  schedule: Schedule, 
  appointmentType: AppointmentType
): boolean {
  // Only scheduled appointments should get reminders
  if (schedule.status !== 'scheduled') {
    return false;
  }

  // Skip if we've already sent a reminder for this appointment
  if (sentReminders.has(schedule.id)) {
    return false;
  }

  // Check if email reminder is configured for this appointment type
  if (!(appointmentType as any).emailReminderTime || (appointmentType as any).emailReminderTime <= 0) {
    return false;
  }

  const now = new Date();
  const appointmentStart = new Date(schedule.startTime);
  
  // Skip appointments in the past
  if (appointmentStart <= now) {
    return false;
  }
  
  // Calculate hours until appointment
  const hoursUntilAppointment = differenceInHours(appointmentStart, now);
  
  // Check if we're within the reminder window
  // Allow 1 hour of flexibility (e.g., if reminder is set for 24 hours, send between 25-24 hours before)
  return hoursUntilAppointment <= (appointmentType as any).emailReminderTime && 
         hoursUntilAppointment > ((appointmentType as any).emailReminderTime - 1);
}

/**
 * Process all upcoming appointments and send reminders as needed
 */
export async function processReminders(): Promise<void> {
  try {
    console.log('[ReminderScheduler] Running reminder check...');
    
    // Get the storage instance
    const storage = await getStorage();
    
    // Get all upcoming schedules (next 7 days)
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 7);
    
    const schedules = await storage.getSchedulesByDateRange(startDate, endDate);
    console.log(`[ReminderScheduler] Found ${schedules.length} upcoming appointments`);
    
    let remindersSent = 0;
    
    // Process each schedule
    for (const schedule of schedules) {
      // Fetch the appointment type to get reminder settings
      const appointmentType = await storage.getAppointmentType(schedule.appointmentTypeId);
      
      if (!appointmentType) {
        console.log(`[ReminderScheduler] Appointment type not found for schedule ${schedule.id}`);
        continue;
      }
      
      // Check if we should send a reminder for this schedule
      if (shouldSendReminder(schedule, appointmentType)) {
        // Get customer email
        const recipientEmail = schedule.driverEmail;
        
        if (!recipientEmail) {
          console.log(`[ReminderScheduler] No recipient email for schedule ${schedule.id}`);
          continue;
        }
        
        // We need the full enhanced schedule data for the email template
        const enhancedSchedule: EnhancedSchedule = {
          ...schedule,
          appointmentType: appointmentType.name,
          facilityName: '',
          timezone: '',
          dockName: ''
        };
        
        // Try to get facility details
        if (schedule.facilityId) {
          try {
            const facility = await storage.getFacility?.(schedule.facilityId); // Add optional chaining for safety
            if (facility) {
              enhancedSchedule.facilityName = facility.name;
              enhancedSchedule.timezone = facility.timezone || 'America/New_York';
            }
          } catch (error) {
            console.error(`[ReminderScheduler] Error getting facility for schedule ${schedule.id}:`, error);
          }
        }
        
        // Try to get dock details
        if (schedule.dockId) {
          try {
            const dock = await storage.getDock?.(schedule.dockId); // Add optional chaining for undefined check
            if (dock) {
              enhancedSchedule.dockName = dock.name;
            }
          } catch (error) {
            console.error(`[ReminderScheduler] Error getting dock for schedule ${schedule.id}:`, error);
          }
        }
        
        // Generate confirmation code - matching the format in other code
        const confirmationCode = `HC${schedule.id}`;
        
        // Calculate hours until appointment (for the email template)
        const appointmentStart = new Date(schedule.startTime);
        const hoursUntilAppointment = differenceInHours(appointmentStart, new Date());
        
        console.log(`[ReminderScheduler] Sending reminder for schedule ${schedule.id} to ${recipientEmail} (${hoursUntilAppointment} hours until appointment)`);
        
        // Send the reminder email
        try {
          const result = await sendReminderEmail(
            recipientEmail,
            confirmationCode,
            // @ts-expect-error: EnhancedSchedule type mismatch between modules
            enhancedSchedule,
            hoursUntilAppointment
          );
          
          if (result) {
            console.log(`[ReminderScheduler] Successfully sent reminder for schedule ${schedule.id}`);
            // Mark this reminder as sent to avoid duplicates
            sentReminders.set(schedule.id, true);
            remindersSent++;
          } else {
            console.error(`[ReminderScheduler] Failed to send reminder for schedule ${schedule.id}`);
          }
        } catch (error) {
          console.error(`[ReminderScheduler] Error sending reminder for schedule ${schedule.id}:`, error);
        }
      }
    }
    
    console.log(`[ReminderScheduler] Reminder check complete. Sent ${remindersSent} reminders.`);
    
    // Clean up old entries from sentReminders map (keep it from growing indefinitely)
    // Only keep entries for appointments that are still in the future
    const now = new Date();
    for (const [scheduleId, sent] of Array.from(sentReminders.entries())) {
      const schedule = schedules.find(s => s.id === scheduleId);
      
      // If the schedule is no longer in our list of upcoming appointments, remove it from the map
      if (!schedule || new Date(schedule.startTime) <= now) {
        sentReminders.delete(scheduleId);
      }
    }
  } catch (error) {
    console.error('[ReminderScheduler] Error processing reminders:', error);
  }
}

// Start the reminder scheduler
// Run every hour to check for reminders that need to be sent
let reminderInterval: NodeJS.Timeout | null = null;

export function startReminderScheduler(): void {
  if (reminderInterval) {
    console.log('[ReminderScheduler] Scheduler already running');
    return;
  }
  
  console.log('[ReminderScheduler] Starting reminder scheduler');
  
  // Run once right away
  processReminders().catch(err => {
    console.error('[ReminderScheduler] Error in initial reminder processing:', err);
  });
  
  // Then run every hour
  reminderInterval = setInterval(async () => {
    try {
      await processReminders();
    } catch (error) {
      console.error('[ReminderScheduler] Error in scheduled reminder processing:', error);
    }
  }, 60 * 60 * 1000); // 1 hour in milliseconds
  
  console.log('[ReminderScheduler] Scheduler started successfully');
}

export function stopReminderScheduler(): void {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
    console.log('[ReminderScheduler] Reminder scheduler stopped');
  }
}