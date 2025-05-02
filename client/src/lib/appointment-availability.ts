// Defining types here directly to avoid circular imports
export interface AvailabilityRule {
  id: number;
  appointmentTypeId: number;
  dayOfWeek: number;
  startDate: string | null;
  endDate: string | null;
  startTime: string;
  endTime: string;
  isActive: boolean;
  facilityId: number;
  maxConcurrent?: number;
  maxAppointmentsPerDay?: number;
  bufferTime?: number;
  gracePeriod?: number;
  showRemainingSlots?: boolean;
}

export interface AvailabilitySlot {
  time: string;
  available: boolean;
  remainingCapacity?: number;
  isBufferTime?: boolean;
}

/**
 * Generate available time slots for a date based on availability rules
 * @param date - Date string in YYYY-MM-DD format
 * @param rules - Array of availability rules
 * @param duration - Duration of the appointment in minutes
 * @param timezone - Timezone string
 * @param interval - Time interval in minutes (15, 30, 60)
 * @returns Array of availability slots
 */
export function generateAvailableTimeSlots(
  date: string,
  rules: AvailabilityRule[],
  duration: number,
  timezone: string = 'America/New_York',
  interval: number = 15
): AvailabilitySlot[] {
  console.log(`[generateAvailableTimeSlots] Generating slots for date: ${date}, rules: ${rules.length}, duration: ${duration}`);

  // Parse the date and get the day of week
  const dateObj = new Date(date);
  const dayOfWeek = dateObj.getDay(); // 0-6, Sunday-Saturday
  
  // Filter rules for this specific day of week
  // We need to get both active and inactive rules
  // Active rules define available slots, inactive rules with maxConcurrent=0 define unavailable slots (like break times)
  const applicableRules = rules.filter(rule => rule.dayOfWeek === dayOfWeek);
  
  // Separate active and inactive rules for processing
  const activeRules = applicableRules.filter(rule => rule.isActive);
  const breakRules = applicableRules.filter(rule => !rule.isActive || rule.maxConcurrent === 0);
  
  // Log buffer time information for applicable rules
  if (applicableRules.length > 0) {
    applicableRules.forEach(rule => {
      console.log(`[generateAvailableTimeSlots] Rule for day ${dayOfWeek} has bufferTime: ${rule.bufferTime || 0} minutes`);
    });
  }
  
  console.log(`[generateAvailableTimeSlots] Found ${applicableRules.length} applicable rules for day ${dayOfWeek}`);
  
  // If no rules apply or empty rules array was passed, check the day of week
  if (rules.length === 0 || applicableRules.length === 0) {
    console.log('[generateAvailableTimeSlots] No applicable rules found for this day');
    
    // For weekends (day 0 = Sunday, day 6 = Saturday), don't return any slots
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      console.log('[generateAvailableTimeSlots] Weekend day, returning no slots');
      return []; // No availability on weekends
    }
    
    // For weekdays, use default business hours: 9am-5pm
    console.log('[generateAvailableTimeSlots] Weekday with no rules, generating default business hours');
    return generateTimeSlotsForRange('09:00', '17:00', interval, duration, true);
  }
  
  // Process each applicable rule to generate available time slots
  let allSlots: AvailabilitySlot[] = [];
  
  // First process active rules to mark available slots
  for (const rule of activeRules) {
    console.log(`[generateAvailableTimeSlots] Processing active rule: ${rule.startTime}-${rule.endTime}, bufferTime: ${rule.bufferTime || 0}, maxConcurrent: ${rule.maxConcurrent || 1}`);
    const ruleSlots = generateTimeSlotsForRange(
      rule.startTime, 
      rule.endTime, 
      interval, 
      duration,
      true, // Available slots
      rule.maxConcurrent || 1,
      rule.bufferTime || 0 // Pass the buffer time to respect gaps between appointments
    );
    
    // Merge with existing slots
    allSlots = mergeTimeSlots(allSlots, ruleSlots);
  }
  
  // Then process break rules to mark unavailable slots
  for (const rule of breakRules) {
    console.log(`[generateAvailableTimeSlots] Processing break rule: ${rule.startTime}-${rule.endTime}`);
    const breakSlots = generateTimeSlotsForRange(
      rule.startTime, 
      rule.endTime, 
      interval, 
      duration,
      false, // Unavailable slots
      0, // Zero capacity for break times
      0 // No buffer needed for break times
    );
    
    // Merge with existing slots, break rules override active rules
    allSlots = mergeTimeSlots(allSlots, breakSlots);
  }
  
  // Sort slots by time
  return allSlots.sort((a, b) => a.time.localeCompare(b.time));
}

/**
 * Generate time slots for a specific time range
 * @param startTime - Start time in HH:MM format
 * @param endTime - End time in HH:MM format
 * @param interval - Interval in minutes
 * @param duration - Duration of appointment in minutes
 * @param available - Whether these slots are available
 * @param remainingCapacity - Optional remaining capacity for these slots
 * @param bufferTime - Optional buffer time between appointments in minutes
 * @returns Array of time slots
 */
/**
 * Generate time slots for a specific time range with support for buffer time
 * Buffer time now determines the interval between slots (not "dead zones")
 * For example, a buffer time of 60 minutes will create hourly slots (8:00, 9:00, 10:00)
 * @param startTime - Start time in HH:MM format
 * @param endTime - End time in HH:MM format
 * @param interval - Interval in minutes (if buffer time is specified, this is ignored)
 * @param duration - Duration of appointment in minutes
 * @param available - Whether these slots are available
 * @param remainingCapacity - Optional remaining capacity for these slots
 * @param bufferTime - Optional buffer time determining interval between appointments
 * @returns Array of time slots
 */
function generateTimeSlotsForRange(
  startTime: string,
  endTime: string,
  interval: number,
  duration: number,
  available: boolean = true,
  remainingCapacity: number = 1,
  bufferTime: number = 0
): AvailabilitySlot[] {
  const slots: AvailabilitySlot[] = [];
  
  // Convert start and end times to minutes for easier calculation
  const startMinutes = convertTimeToMinutes(startTime);
  const endMinutes = convertTimeToMinutes(endTime);
  
  // Calculate the last possible start time based on appointment duration
  const lastPossibleStart = endMinutes - duration;
  
  // If buffer time is specified and greater than the default interval, use it as the interval
  // This will create slots at buffer time intervals (e.g., 60 minutes will create hourly slots)
  const slotInterval = (bufferTime && bufferTime > interval) ? bufferTime : interval;
  
  console.log(`[generateTimeSlotsForRange] Using interval of ${slotInterval} minutes (buffer: ${bufferTime}, default: ${interval})`);
    
  // Generate slots at the determined interval
  for (let time = startMinutes; time <= lastPossibleStart; time += slotInterval) {
    const appointmentEndMinutes = time + duration;
    
    slots.push({
      time: convertMinutesToTime(time),
      available: available,
      remainingCapacity: remainingCapacity,
      isBufferTime: false // Not a buffer time slot by default
    });
  }
  
  console.log(`[generateTimeSlotsForRange] Generated ${slots.length} slots with interval: ${slotInterval} minutes`);
  
  return slots;
}

/**
 * Merge two sets of time slots, giving priority to the second set
 * @param existingSlots - Existing slots
 * @param newSlots - New slots to merge
 * @returns Merged slots
 */
function mergeTimeSlots(
  existingSlots: AvailabilitySlot[],
  newSlots: AvailabilitySlot[]
): AvailabilitySlot[] {
  // Create a map of existing slots for easy lookup
  const slotMap = new Map<string, AvailabilitySlot>();
  existingSlots.forEach(slot => slotMap.set(slot.time, slot));
  
  // Merge or add new slots
  newSlots.forEach(newSlot => {
    const existingSlot = slotMap.get(newSlot.time);
    
    if (existingSlot) {
      // If there's a conflict, new slot wins, but keep buffer time flags
      // Buffer slots should always remain as buffer (unavailable)
      const isBuffer = existingSlot.isBufferTime || newSlot.isBufferTime;
      
      slotMap.set(newSlot.time, {
        ...newSlot,
        // Buffer slots are never available
        available: isBuffer ? false : newSlot.available,
        isBufferTime: isBuffer,
        remainingCapacity: isBuffer ? 0 : Math.max(existingSlot.remainingCapacity || 0, newSlot.remainingCapacity || 0)
      });
    } else {
      // If no conflict, add the new slot
      slotMap.set(newSlot.time, newSlot);
    }
  });
  
  // Convert back to array
  return Array.from(slotMap.values());
}

/**
 * Convert time in HH:MM format to minutes since midnight
 * @param time - Time in HH:MM format
 * @returns Minutes since midnight
 */
function convertTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes since midnight to HH:MM format
 * @param minutes - Minutes since midnight
 * @returns Time in HH:MM format
 */
function convertMinutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}