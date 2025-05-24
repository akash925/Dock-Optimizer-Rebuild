import { Schedule } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import UnifiedAppointmentForm from "@/components/shared/unified-appointment-form";

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
  const { toast } = useToast();
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'edit' ? 'Edit Appointment' : 'Create New Appointment'}
          </DialogTitle>
        </DialogHeader>
        
        <UnifiedAppointmentForm
          mode="internal"
          isOpen={isOpen}
          onClose={onClose}
          initialData={initialData}
          editMode={mode}
          initialDate={initialDate}
          initialDockId={initialDockId}
          appointmentTypeId={appointmentTypeId}
          facilityId={initialData?.facilityId}
          facilityTimezone={timezone}
          onSubmitSuccess={(data) => {
            toast({
              title: `Appointment ${mode === 'edit' ? 'Updated' : 'Created'}`,
              description: `The appointment has been successfully ${mode === 'edit' ? 'updated' : 'created'}.`,
            });
            onClose();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}