// This is a proxy file that re-exports the fixed implementation
import { useAppointmentAvailability, UseAppointmentAvailabilityProps } from './use-appointment-availability-fixed';
import { TimeSlot } from '@/components/booking/time-slot-picker';

export { 
  useAppointmentAvailability,
  type UseAppointmentAvailabilityProps, 
  type TimeSlot 
};