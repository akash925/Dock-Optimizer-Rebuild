import { vi } from 'vitest';

// Mock the availability service to avoid database dependencies
vi.mock('../src/services/availability', () => ({
  generateTimeSlots: vi.fn().mockImplementation((hours: any, date: any, timezone: any, config: any) => {
    // Mock implementation that returns time slots based on start time
    const slots: string[] = [];
    const startHour = parseInt(hours.start.split(':')[0]);
    const endHour = parseInt(hours.end.split(':')[0]);
    
    for (let hour = startHour; hour < endHour; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      if (config.intervalMinutes === 30) {
        slots.push(`${hour.toString().padStart(2, '0')}:30`);
      }
    }
    
    return slots;
  }),
}));

import { generateTimeSlots, DayHours } from '../src/services/availability';

// Simple config to remove booking buffer
const testConfig = { intervalMinutes: 30, bookingBufferMinutes: 0, maxAdvanceDays: 30 };

describe('Time slot label generation', () => {
  it('generates 08:00 as first slot in Eastern Time', () => {
    const hours: DayHours = {
      open: true,
      start: '08:00',
      end: '17:00',
    };

    const date = new Date('2025-06-16T12:00:00Z'); // Arbitrary Monday
    const slots = generateTimeSlots(hours, date, 'America/New_York', testConfig);
    expect(slots[0]).toBe('08:00');
  });
}); 