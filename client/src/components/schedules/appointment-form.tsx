import AppointmentForm from "@/components/shared/appointment-form-fixed";
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
  // Use our new improved appointment form component
  return (
    <AppointmentForm
      mode="internal"
      isOpen={isOpen}
      onClose={onClose}
      initialData={initialData}
      editMode={mode}
      initialDate={initialDate}
      initialDockId={initialDockId}
      appointmentTypeId={appointmentTypeId}
      facilityTimezone={timezone}
    />
  );
}