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
  const applicableRules = rules.filter(rule => rule.dayOfWeek === dayOfWeek && rule.isActive);
  
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
  
  for (const rule of applicableRules) {
    console.log(`[generateAvailableTimeSlots] Processing rule: ${rule.startTime}-${rule.endTime}, bufferTime: ${rule.bufferTime || 0}`);
    const ruleSlots = generateTimeSlotsForRange(
      rule.startTime, 
      rule.endTime, 
      interval, 
      duration,
      true, // Default to available
      rule.maxConcurrent || 1,
      rule.bufferTime || 0 // Pass the buffer time to respect gaps between appointments
    );
    
    // Merge with existing slots
    allSlots = mergeTimeSlots(allSlots, ruleSlots);
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
  
  // If buffer time is specified, we need to handle it specially
  if (bufferTime > 0) {
    console.log(`[generateTimeSlotsForRange] Using buffer time: ${bufferTime} minutes`);
    
    // With buffer time, we need to space out slots based on duration + buffer time
    // Calculate how many intervals we need to skip
    const totalTimeNeeded = duration + bufferTime;
    const intervalsToSkip = Math.ceil(totalTimeNeeded / interval);
    
    // Generate slots with appropriate spacing
    // We will generate all slots but mark some as buffer slots
    let currentTime = startMinutes;
    
    while (currentTime <= lastPossibleStart) {
      // Add the current slot
      slots.push({
        time: convertMinutesToTime(currentTime),
        available: available,
        remainingCapacity: remainingCapacity,
        isBufferTime: false // This is not a buffer time slot
      });
      
      // Now add buffer time slots
      for (let i = 1; i < intervalsToSkip && (currentTime + i * interval) <= endMinutes; i++) {
        const bufferSlotTime = currentTime + (i * interval);
        
        // Only add buffer slots if they don't exceed the last possible start
        if (bufferSlotTime <= lastPossibleStart) {
          slots.push({
            time: convertMinutesToTime(bufferSlotTime),
            available: false, // Buffer slots are not available
            remainingCapacity: 0,
            isBufferTime: true // Mark as buffer time slot
          });
        }
      }
      
      // Move to the next non-buffer slot
      currentTime += interval * intervalsToSkip;
    }
    
    console.log(`[generateTimeSlotsForRange] Generated ${slots.length} slots with buffer time: ${bufferTime} minutes`);
  } else {
    // Without buffer time, generate slots at each interval
    for (let time = startMinutes; time <= lastPossibleStart; time += interval) {
      slots.push({
        time: convertMinutesToTime(time),
        available: available,
        remainingCapacity: remainingCapacity,
        isBufferTime: false
      });
    }
  }
  
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