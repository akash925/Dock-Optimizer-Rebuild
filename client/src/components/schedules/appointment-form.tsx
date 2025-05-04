import ExternalBookingModal from "@/components/shared/external-booking-modal";
import { Schedule } from "@shared/schema";

interface AppointmentFormProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Schedule;
  mode: "create" | "edit";
  initialDate?: Date;
  initialDockId?: number;
  appointmentTypeId?: number;
  timezone?: string;
  timeFormat?: "12h" | "24h";
}

export default function ScheduleAppointmentForm({
  isOpen,
  onClose,
  initialData,
  mode,
  initialDate,
  initialDockId,
  appointmentTypeId,
  timezone,
  timeFormat,
}: AppointmentFormProps) {
  // Use our external booking wizard component as a modal for internal booking
  // This ensures consistency between external and internal booking flows
  return (
    <ExternalBookingModal
      isOpen={isOpen}
      onClose={onClose}
      initialData={initialData}
      facilityId={initialData?.facilityId}
      appointmentTypeId={appointmentTypeId}
      timezone={timezone}
      initialDate={initialDate}
      initialDockId={initialDockId}
      editMode={mode}
    />
  );
}