import ExternalBookingModal from "@/components/shared/external-booking-modal";
import { Schedule } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BookingWizardProvider } from "@/contexts/BookingWizardContext";
import { BookingWizardContent } from "@/components/shared/booking-wizard-content";

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
  
  // Create a fake booking page object for the internal mode
  // This allows us to reuse the external booking wizard component
  const fakeBookingPage = {
    id: 0,
    slug: 'internal',
    name: 'Internal Booking',
    title: 'Create Appointment',
    description: 'Create or edit an appointment',
    organizationId: 0,
    tenantId: 0,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'edit' ? 'Edit Appointment' : 'Create New Appointment'}
          </DialogTitle>
        </DialogHeader>
        
        <BookingWizardProvider>
          <BookingWizardContent 
            bookingPage={fakeBookingPage}
            isLoadingBookingPage={false}
            bookingPageError={null}
            shouldReset={false}
            slug="internal"
            navigate={() => {}}
            toast={toast}
            initialFacilityId={initialData?.facilityId}
            initialAppointmentTypeId={appointmentTypeId}
            initialDate={initialDate}
            initialDockId={initialDockId}
            onSubmitSuccess={(data) => {
              toast({
                title: `Appointment ${mode === 'edit' ? 'Updated' : 'Created'}`,
                description: `The appointment has been successfully ${mode === 'edit' ? 'updated' : 'created'}.`,
              });
              onClose();
            }}
            onCancel={onClose}
            internalMode={true}
          />
        </BookingWizardProvider>
      </DialogContent>
    </Dialog>
  );
}