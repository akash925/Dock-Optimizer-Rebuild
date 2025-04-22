import FixedAppointmentForm from "@/components/shared/fixed-appointment-form";
import { Schedule } from "@shared/schema";

interface AppointmentFormProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Schedule;
  mode: "create" | "edit";
  initialDate?: Date;
  initialDockId?: number;
  appointmentTypeId?: number;
}

export default function AppointmentForm({
  isOpen,
  onClose,
  initialData,
  mode,
  initialDate,
  initialDockId,
  appointmentTypeId,
}: AppointmentFormProps) {
  // Use the fixed component to avoid FormContext errors
  return (
    <FixedAppointmentForm
      mode="internal"
      isOpen={isOpen}
      onClose={onClose}
      initialData={initialData}
      editMode={mode}
      initialDate={initialDate}
      initialDockId={initialDockId}
      appointmentTypeId={appointmentTypeId}
    />
  );
}