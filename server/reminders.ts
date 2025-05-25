import { getStorage } from './storage';
import { sendReminderEmail } from './notifications';
import { addDays, addHours, isAfter, isBefore, parseISO } from 'date-fns';

// Initialize reminder system
let reminderInterval: NodeJS.Timeout | null = null;

// Start the reminder scheduler
export function startReminderScheduler() {
  if (reminderInterval) {
    clearInterval(reminderInterval);
  }
  
  console.log("[ReminderScheduler] Starting email reminder scheduler");
  
  // Check for appointments that need reminders every 30 minutes
  reminderInterval = setInterval(checkAndSendReminders, 30 * 60 * 1000);
  
  // Also run immediately on startup
  checkAndSendReminders();
}

// Stop the reminder scheduler
export function stopReminderScheduler() {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
    console.log("[ReminderScheduler] Email reminder scheduler stopped");
  }
}

// Check for appointments that need reminders and send them
async function checkAndSendReminders() {
  try {
    console.log("[ReminderScheduler] Checking for appointments that need reminders");
    const storage = getStorage();
    
    // Get upcoming appointments for the next 48 hours
    const now = new Date();
    const twoDaysFromNow = addDays(now, 2);
    
    // Get all schedules within the next 48 hours
    const schedules = await storage.getSchedulesByDateRange(
      now.toISOString(),
      twoDaysFromNow.toISOString()
    );
    
    console.log(`[ReminderScheduler] Found ${schedules.length} upcoming appointments in the next 48 hours`);
    
    let remindersSent = 0;
    
    for (const schedule of schedules) {
      // Skip if the schedule doesn't have an email address
      if (!schedule.email) {
        continue;
      }
      
      // Skip if reminder already sent
      if (schedule.reminderSent) {
        continue;
      }
      
      // Calculate when the reminder should be sent (24 hours before appointment)
      const appointmentTime = parseISO(schedule.startTime);
      const reminderTime = addHours(appointmentTime, -24);
      
      // Send reminder if it's time (if current time is after the reminder time)
      if (isAfter(now, reminderTime) && isBefore(now, appointmentTime)) {
        console.log(`[ReminderScheduler] Sending reminder for appointment ${schedule.id} to ${schedule.email}`);
        
        try {
          await sendReminderEmail(schedule);
          
          // Mark reminder as sent
          await storage.updateSchedule(schedule.id, { 
            reminderSent: true 
          });
          
          remindersSent++;
        } catch (error) {
          console.error(`[ReminderScheduler] Error sending reminder for appointment ${schedule.id}:`, error);
        }
      }
    }
    
    console.log(`[ReminderScheduler] Sent ${remindersSent} reminders`);
  } catch (error) {
    console.error("[ReminderScheduler] Error checking for reminders:", error);
  }
}