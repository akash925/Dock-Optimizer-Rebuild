import { useState } from "react";
import AppointmentForm from "@/components/shared/appointment-form-fixed";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  // Track when the appointment is submitted successfully
  const handleSuccess = () => {
    if (onSuccess) {
      onSuccess();
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Appointment</DialogTitle>
        </DialogHeader>
        
        <AppointmentForm
          mode="internal"
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