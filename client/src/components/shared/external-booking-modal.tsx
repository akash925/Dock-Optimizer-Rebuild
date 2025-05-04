import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BookingWizardProvider, useBookingWizard } from '@/contexts/BookingWizardContext';
import { useToast } from '@/hooks/use-toast';
import { Schedule, Facility, BookingPage } from '@shared/schema';
import { BookingWizardContent } from './booking-wizard-content';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface ExternalBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Schedule;
  facilityId?: number;
  appointmentTypeId?: number;
  timezone?: string;
  initialDate?: Date;
  initialDockId?: number;
  editMode?: 'create' | 'edit';
}

export default function ExternalBookingModal({
  isOpen,
  onClose,
  initialData,
  facilityId,
  appointmentTypeId,
  timezone = 'America/New_York',
  initialDate,
  initialDockId,
  editMode = 'create'
}: ExternalBookingModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Create a fake booking page object for the internal mode
  // This allows us to reuse the external booking components
  const [fakeBookingPage] = useState<BookingPage>({
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
  });
  
  // Mutation for submitting the appointment
  const appointmentMutation = useMutation({
    mutationFn: async (data: any) => {
      const endpoint = editMode === 'edit' 
        ? `/api/schedules/${initialData?.id}` 
        : '/api/schedules';
        
      const method = editMode === 'edit' ? 'PATCH' : 'POST';
      
      const res = await apiRequest(method, endpoint, data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: `Appointment ${editMode === 'edit' ? 'Updated' : 'Created'}`,
        description: `The appointment has been successfully ${editMode === 'edit' ? 'updated' : 'created'}.`,
      });
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/schedules'] });
      
      // Close the modal
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to ${editMode === 'edit' ? 'update' : 'create'} appointment: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Process appointment data from wizard and submit to API
  const handleAppointmentSubmit = (appointmentData: any) => {
    // Transform data format if needed
    const formattedData = {
      ...appointmentData,
      facilityId: facilityId || appointmentData.facilityId,
      appointmentTypeId: appointmentTypeId || appointmentData.appointmentTypeId,
      // Any other transformations needed for the internal API
    };
    
    // Submit appointment
    appointmentMutation.mutate(formattedData);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editMode === 'edit' ? 'Edit Appointment' : 'Create New Appointment'}
          </DialogTitle>
        </DialogHeader>
        
        <BookingWizardProvider 
          initialData={{
            type: initialData?.type || 'inbound',
            appointmentMode: 'trailer',
            facilityId: facilityId || initialData?.facilityId,
            appointmentTypeId: appointmentTypeId || initialData?.appointmentTypeId,
            scheduledStart: initialData?.scheduledStart,
            facilityTimezone: timezone,
            // Populate with initial data if editing
            ...(initialData && {
              customerName: initialData.customerName,
              carrierName: initialData.carrierName,
              mcNumber: initialData.mcNumber,
              truckNumber: initialData.truckNumber,
              trailerNumber: initialData.trailerNumber,
              driverName: initialData.driverName,
              driverPhone: initialData.driverPhone,
              driverEmail: initialData.driverEmail,
              bolNumber: initialData.bolNumber,
              poNumber: initialData.poNumber,
              palletCount: initialData.palletCount,
              weight: initialData.weight,
              notes: initialData.notes,
            })
          }}
        >
          <BookingWizardContent 
            bookingPage={fakeBookingPage}
            isLoadingBookingPage={false}
            bookingPageError={null}
            shouldReset={false}
            internalMode={true}
            initialDate={initialDate}
            initialDockId={initialDockId}
            onSubmitSuccess={handleAppointmentSubmit}
            onCancel={onClose}
          />
        </BookingWizardProvider>
      </DialogContent>
    </Dialog>
  );
}