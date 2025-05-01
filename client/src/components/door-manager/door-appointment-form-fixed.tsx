import { useState, useEffect } from "react";
import AppointmentForm from "@/components/shared/appointment-form-fixed";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { Facility, AppointmentType } from "@shared/schema";
import { format, addHours } from "date-fns";

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
        console.log(`[DoorAppointmentForm] Found facility: ${facility.name} (ID: ${facility.id})`);
        setFacilityName(facility.name);
        
        // For facility changes, always update the appointment type
        if (appointmentTypes.length > 0) {
          // Reset the form initialization flag when facility changes
          setInitializedForm(false);
          
          console.log(`[DoorAppointmentForm] Looking for appointment types for facility ${facilityId}`);
          const facilityAppointmentTypes = appointmentTypes.filter(type => type.facilityId === facilityId);
          
          if (facilityAppointmentTypes.length > 0) {
            // Set the first appointment type for this facility
            console.log(`[DoorAppointmentForm] Found ${facilityAppointmentTypes.length} appointment types for facility, using type ID: ${facilityAppointmentTypes[0].id}`);
            setInitialAppointmentTypeId(facilityAppointmentTypes[0].id);
          } else {
            // Fallback to any appointment type
            console.log(`[DoorAppointmentForm] No appointment types for facility ${facilityId}, falling back to default type ID: ${appointmentTypes[0].id}`);
            setInitialAppointmentTypeId(appointmentTypes[0].id);
          }
          setInitializedForm(true);
        }
      } else {
        console.log(`[DoorAppointmentForm] Warning: Facility ID ${facilityId} not found in facilities list`);
      }
    }
  }, [facilityId, facilities, appointmentTypes]);

  // Track when the appointment is submitted successfully
  const handleSuccess = () => {
    if (onSuccess) {
      onSuccess();
    }
    onClose();
  };

  // Create a default date for new appointments (current date + 1 hour, rounded to nearest 30 min)
  const defaultDate = (() => {
    const now = new Date();
    
    // Add 1 hour to current time
    const futureDate = addHours(now, 1);
    
    // Round to nearest 30 minute increment
    const minutes = futureDate.getMinutes();
    const roundedMinutes = Math.round(minutes / 30) * 30;
    futureDate.setMinutes(roundedMinutes, 0, 0);
    
    return futureDate;
  })();

  // Debug logs to verify props
  console.log("[DoorAppointmentForm] Props:", { 
    dockId, 
    facilityId, 
    facilityName: facilityName || propFacilityName, 
    isOpen,
    defaultDate: format(defaultDate, "yyyy-MM-dd HH:mm")
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
          facilityId={facilityId}
          facilityName={facilityName}
          appointmentTypeId={initialAppointmentTypeId}
          onClose={onClose}
          onSubmitSuccess={handleSuccess}
          editMode="create"
          initialDate={defaultDate} // Use calculated future date as initial date
        />
      </DialogContent>
    </Dialog>
  );
}