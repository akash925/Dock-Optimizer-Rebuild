import { useState, useEffect } from "react";
import AppointmentForm from "@/components/shared/appointment-form-fixed";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { Facility, AppointmentType } from "@shared/schema";
import { format } from "date-fns";

interface DoorAppointmentFormProps {
  isOpen: boolean;
  onClose: () => void;
  dockId: number;
  facilityId?: number;
  facilityName?: string;
  onSuccess?: () => void;
}

export default function DoorAppointmentForm({
  isOpen,
  onClose,
  dockId,
  facilityId,
  facilityName: propFacilityName,
  onSuccess,
}: DoorAppointmentFormProps) {
  // Get facility name for display
  const [facilityName, setFacilityName] = useState<string | undefined>(propFacilityName);
  const [initialAppointmentTypeId, setInitialAppointmentTypeId] = useState<number | undefined>(undefined);
  const [initializedForm, setInitializedForm] = useState(false);
  
  // Fetch facilities to get the facility name
  const { data: facilities = [] } = useQuery<Facility[]>({
    queryKey: ["/api/facilities"],
  });
  
  // Fetch appointment types to pre-select one
  const { data: appointmentTypes = [] } = useQuery<AppointmentType[]>({
    queryKey: ["/api/appointment-types"],
  });
  
  // Set facility name when component loads or facilityId changes
  useEffect(() => {
    if (facilityId && facilities.length > 0) {
      const facility = facilities.find(f => f.id === facilityId);
      if (facility) {
        setFacilityName(facility.name);
        
        // Find an appropriate appointment type for this facility
        if (!initializedForm && appointmentTypes.length > 0) {
          const facilityAppointmentTypes = appointmentTypes.filter(type => type.facilityId === facilityId);
          if (facilityAppointmentTypes.length > 0) {
            // Set the first appointment type for this facility
            setInitialAppointmentTypeId(facilityAppointmentTypes[0].id);
          } else {
            // Fallback to any appointment type
            setInitialAppointmentTypeId(appointmentTypes[0].id);
          }
          setInitializedForm(true);
        }
      }
    }
  }, [facilityId, facilities, appointmentTypes, initializedForm]);

  // Track when the appointment is submitted successfully
  const handleSuccess = () => {
    if (onSuccess) {
      onSuccess();
    }
    onClose();
  };

  // Debug logs to verify props
  console.log("[DoorAppointmentForm] Props:", { 
    dockId, 
    facilityId, 
    facilityName: facilityName || propFacilityName, 
    isOpen
  });

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
          initialFacilityId={facilityId}
          facilityId={facilityId}
          facilityName={facilityName}
          appointmentTypeId={initialAppointmentTypeId}
          onClose={onClose}
          onSubmitSuccess={handleSuccess}
          editMode="create"
          initialDate={new Date()} // Use current date as initial date
        />
      </DialogContent>
    </Dialog>
  );
}