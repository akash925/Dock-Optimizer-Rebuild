import { Schedule } from "@shared/schema";

/**
 * Extends the basic Schedule type with additional fields needed for the UI
 */
export interface EnhancedSchedule extends Schedule {
  // These fields are added by the API in some responses but aren't in the base Schedule type
  facilityId?: number;
  facilityName?: string;
  appointmentTypeName?: string;
  dockName?: string;
}

/**
 * Get a display-friendly confirmation code (e.g., HC123)
 */
export function getConfirmationCode(schedule: Schedule): string {
  return `HC${schedule.id}`;
}

/**
 * Parse a confirmation code string to extract the numeric ID
 */
export function parseConfirmationCode(code: string): number | null {
  const cleanCode = code.replace(/^HC/i, '');
  const id = parseInt(cleanCode, 10);
  return isNaN(id) ? null : id;
}

/**
 * Get a formatted status label for display
 */
export function getStatusLabel(status: string): string {
  switch (status) {
    case 'scheduled':
      return 'Scheduled';
    case 'in-progress':
      return 'In Progress';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
}

/**
 * Check if a schedule can be rescheduled
 */
export function canReschedule(schedule: Schedule): boolean {
  return schedule.status === 'scheduled';
}

/**
 * Check if a schedule can be cancelled
 */
export function canCancel(schedule: Schedule): boolean {
  return schedule.status === 'scheduled';
}