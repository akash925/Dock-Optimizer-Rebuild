// Export the availability services from the src/services/availability.ts file
import { 
  fetchRelevantAppointmentsForDay,
  calculateAvailabilitySlots,
  AvailabilitySlot 
} from '../src/services/availability';

export {
  fetchRelevantAppointmentsForDay,
  calculateAvailabilitySlots,
  AvailabilitySlot
};