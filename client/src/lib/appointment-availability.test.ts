import { isTimeSlotAvailable, generateAvailableTimeSlots, AvailabilityRule } from './appointment-availability';

describe('isTimeSlotAvailable', () => {
  // Sample date for testing
  const testDate = '2025-04-22';
  
  // Sample rules for testing
  const activeRule: AvailabilityRule = {
    id: 1,
    appointmentTypeId: 1,
    dayOfWeek: 2, // Tuesday (0-indexed, so 0 = Sunday, 2 = Tuesday)
    startDate: null,
    endDate: null,
    startTime: '09:00',
    endTime: '17:00',
    isActive: true,
    facilityId: 1,
    maxConcurrent: 3
  };

  const ruleWithBuffer: AvailabilityRule = {
    ...activeRule,
    id: 2,
    bufferTime: 30, // 30 minute buffer
    gracePeriod: 15 // 15 minute grace period
  };

  test('should return valid for a timeslot fully within an active rule', () => {
    const result = isTimeSlotAvailable(testDate, '12:00', [activeRule], 60);
    expect(result.valid).toBe(true);
  });

  test('should return invalid for a timeslot outside rule hours', () => {
    const result = isTimeSlotAvailable(testDate, '08:00', [activeRule], 60);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('outside of available hours');
  });

  test('should return invalid for a timeslot that extends beyond rule end time', () => {
    const result = isTimeSlotAvailable(testDate, '16:30', [activeRule], 60);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('outside of available hours');
  });

  test('should handle buffer times correctly', () => {
    // Inside rule hours but need to account for buffer time
    const result = isTimeSlotAvailable(testDate, '16:00', [ruleWithBuffer], 60);
    expect(result.valid).toBe(true);
  });

  test('should handle grace periods correctly', () => {
    // Just before the rule start time but within grace period
    const result = isTimeSlotAvailable(testDate, '08:50', [ruleWithBuffer], 60);
    expect(result.valid).toBe(false); // Still invalid because we're checking exact matches
  });

  test('should return valid when no rules are provided (fallback)', () => {
    const result = isTimeSlotAvailable(testDate, '12:00', [], 60);
    expect(result.valid).toBe(true);
  });

  test('should validate time format correctly', () => {
    const result = isTimeSlotAvailable(testDate, 'invalid-time', [activeRule], 60);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('Invalid time format');
  });

  test('should validate date format correctly', () => {
    const result = isTimeSlotAvailable('invalid-date', '12:00', [activeRule], 60);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('Invalid date format');
  });

  test('should handle inactive rules correctly', () => {
    const inactiveRule = { ...activeRule, isActive: false };
    const result = isTimeSlotAvailable(testDate, '12:00', [inactiveRule], 60);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('No availability rules found');
  });
});

describe('generateAvailableTimeSlots', () => {
  // Sample date for testing (a Tuesday)
  const testDate = '2025-04-22';
  
  // Test rule for a typical 9-5 workday
  const standardRule: AvailabilityRule = {
    id: 1,
    appointmentTypeId: 1,
    dayOfWeek: 2, // Tuesday
    startDate: null,
    endDate: null,
    startTime: '09:00',
    endTime: '17:00',
    isActive: true,
    facilityId: 1,
    maxConcurrent: 2
  };

  // Another rule for extended hours
  const extendedRule: AvailabilityRule = {
    ...standardRule,
    id: 2,
    startTime: '17:00',
    endTime: '20:00',
  };

  test('should generate slots for empty rules array (all available)', () => {
    const slots = generateAvailableTimeSlots(testDate, [], 60, 'UTC', 60);
    
    // Should generate 24 hourly slots for a day
    expect(slots.length).toBe(24);
    
    // All slots should be available
    expect(slots.every(slot => slot.available)).toBe(true);
    
    // Each slot should have remaining = 1 (default when no rules)
    expect(slots.every(slot => slot.remaining === 1)).toBe(true);
    
    // First slot should be at midnight
    expect(slots[0].time).toBe('00:00');
    
    // Last slot should be at 23:00
    expect(slots[23].time).toBe('23:00');
  });

  test('should generate correct slots for a single rule', () => {
    // Using 30 minute intervals
    const slots = generateAvailableTimeSlots(testDate, [standardRule], 60, 'UTC', 30);
    
    // Should generate 48 half-hour slots for a day
    expect(slots.length).toBe(48);
    
    // Check available slots are within rule hours
    const availableSlots = slots.filter(slot => slot.available);
    expect(availableSlots.length).toBeGreaterThan(0);
    
    // The 9:00 slot should be available
    const nineAMSlot = slots.find(slot => slot.time === '09:00');
    expect(nineAMSlot?.available).toBe(true);
    expect(nineAMSlot?.remaining).toBe(2); // maxConcurrent from rule
    
    // The 8:30 slot should not be available (before opening)
    const earlySlot = slots.find(slot => slot.time === '08:30');
    expect(earlySlot?.available).toBe(false);
    
    // The 17:00 slot should not be available (right at closing)
    const fivePMSlot = slots.find(slot => slot.time === '17:00');
    expect(fivePMSlot?.available).toBe(false);
  });

  test('should handle multiple overlapping rules correctly', () => {
    // Using 60 minute intervals with standard and extended rules
    const slots = generateAvailableTimeSlots(testDate, [standardRule, extendedRule], 60, 'UTC', 60);
    
    // Should generate 24 hourly slots for a day
    expect(slots.length).toBe(24);
    
    // The 9:00 slot should be available (standard rule)
    const nineAMSlot = slots.find(slot => slot.time === '09:00');
    expect(nineAMSlot?.available).toBe(true);
    
    // The 17:00 slot should be available (extended rule starts at 17:00)
    const fivePMSlot = slots.find(slot => slot.time === '17:00');
    expect(fivePMSlot?.available).toBe(true);
    
    // The 19:00 slot should be available (within extended rule)
    const sevenPMSlot = slots.find(slot => slot.time === '19:00');
    expect(sevenPMSlot?.available).toBe(true);
    
    // The 20:00 slot should not be available (after extended rule)
    const eightPMSlot = slots.find(slot => slot.time === '20:00');
    expect(eightPMSlot?.available).toBe(false);
  });

  test('should handle invalid date format', () => {
    expect(() => {
      generateAvailableTimeSlots('invalid-date', [standardRule], 60);
    }).toThrow('Invalid date format');
  });

  test('should handle error and return all unavailable slots as fallback', () => {
    // Mocking a runtime error during generation
    jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Create an invalid rule that will cause errors during validation
    const invalidRule = {
      ...standardRule,
      startTime: 'invalid-time', // This will cause an error
    } as unknown as AvailabilityRule;
    
    const slots = generateAvailableTimeSlots(testDate, [invalidRule], 60, 'UTC', 60);
    
    // Should still generate 24 hourly slots for a day
    expect(slots.length).toBe(24);
    
    // All slots should be unavailable due to error
    expect(slots.every(slot => !slot.available)).toBe(true);
    
    // All slots should have reason indicating error
    expect(slots.every(slot => slot.reason?.includes('Error'))).toBe(true);
    
    // Restore console
    jest.restoreAllMocks();
  });
});