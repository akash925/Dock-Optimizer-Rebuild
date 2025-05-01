import { useState, useEffect } from "react";
import AppointmentForm from "@/components/shared/appointment-form-fixed";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { Facility } from "@shared/schema";

interface DoorAppointmentFormProps {
  isOpen: boolean;
  onClose: () => void;
  dockId: number;
  facilityId?: number;
  onSuccess?: () => void;
}

export default function DoorAppointmentForm({
  isOpen,
  onClose,
  dockId,
  facilityId,
  onSuccess,
}: DoorAppointmentFormProps) {
  // Get facility name for display
  const [facilityName, setFacilityName] = useState<string | undefined>(undefined);
  
  // Fetch facilities to get the facility name
  const { data: facilities = [] } = useQuery<Facility[]>({
    queryKey: ["/api/facilities"],
  });
  
  // Set facility name when component loads or facilityId changes
  useEffect(() => {
    if (facilityId && facilities.length > 0) {
      const facility = facilities.find(f => f.id === facilityId);
      if (facility) {
        setFacilityName(facility.name);
      }
    }
  }, [facilityId, facilities]);

  // Track when the appointment is submitted successfully
  const handleSuccess = () => {
    if (onSuccess) {
      onSuccess();
    }
    onClose();
  };

  // Debug logs to verify props
  console.log("[DoorAppointmentForm] Props:", { dockId, facilityId, facilityName, isOpen });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Create New Appointment
            {facilityName ? ` at ${facilityName}` : ''}
          </DialogTitle>
        </DialogHeader>
        
        <AppointmentForm
          mode="internal"
          isOpen={true}
          initialDockId={dockId}
          facilityId={facilityId}
          onClose={onClose}
          onSubmitSuccess={handleSuccess}
          editMode="create"
        />
      </DialogContent>
    </Dialog>
  );
}