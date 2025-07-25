import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BookingWizardProvider, useBookingWizard } from '@/contexts/BookingWizardContext';
import { useToast } from '@/hooks/use-toast';
import { Schedule, Facility, BookingPage } from '@shared/schema';
import { BookingWizardContent } from '@/components/shared/booking-wizard-content';
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
  
  // Mutation for submitting the appointment - using the same endpoint as external booking
  const appointmentMutation = useMutation({
    mutationFn: async (data: any) => {
      // For edit mode, use the standard PATCH endpoint
      if (editMode === 'edit' && initialData?.id) {
        const res = await apiRequest('PATCH', `/api/schedules/${initialData.id}`, data);
        return await res.json();
      }
      
      // For create mode, use the external booking endpoint with internal flag
      const res = await apiRequest('POST', '/api/schedules/external', data);
      return await res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: `Appointment ${editMode === 'edit' ? 'Updated' : 'Created'}`,
        description: `The appointment has been successfully ${editMode === 'edit' ? 'updated' : 'created'}.${data?.confirmationCode ? ` Confirmation code: ${data.confirmationCode}` : ''}`,
      });
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/schedules'] });
      
      // Close the modal
      onClose();
    },
    onError: (error: Error) => {
      // Check for specific error codes
      if (error.message.includes('SLOT_UNAVAILABLE')) {
        toast({
          title: 'Time Slot Unavailable',
          description: 'The selected time slot is no longer available. Please select a different time.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: `Failed to ${editMode === 'edit' ? 'update' : 'create'} appointment: ${error.message}`,
          variant: 'destructive',
        });
      }
    },
  });

  // Process appointment data from wizard and submit to API
  const handleAppointmentSubmit = (appointmentData: any) => {
    console.log("Received data from wizard:", appointmentData);
    
    if (editMode === 'edit' && initialData?.id) {
      // Transform data format for API submission in edit mode
      // Use the same format as create to ensure consistency
      const formattedData = {
        ...(initialData || {}),
        id: initialData.id, // Make sure to include the ID for the update operation
        
        // Core appointment details
        facilityId: facilityId || appointmentData.facilityId,
        appointmentTypeId: appointmentTypeId || appointmentData.appointmentTypeId,
        pickupOrDropoff: appointmentData.pickupOrDropoff || "dropoff",
        startTime: appointmentData.startTime,
        endTime: appointmentData.endTime,
        dockId: initialDockId || appointmentData.dockId,
        
        // Company and contact details
        companyName: appointmentData.companyName,
        contactName: appointmentData.contactName,
        email: appointmentData.email,
        phone: appointmentData.phone,
        customerRef: appointmentData.customerRef || "",
        
        // Carrier and vehicle details
        carrierId: appointmentData.carrierId,
        carrierName: appointmentData.carrierName,
        driverName: appointmentData.driverName,
        driverPhone: appointmentData.driverPhone,
        driverEmail: appointmentData.driverEmail || appointmentData.email,
        mcNumber: appointmentData.mcNumber || "",
        truckNumber: appointmentData.truckNumber,
        trailerNumber: appointmentData.trailerNumber || "",
        
        // Additional details
        notes: appointmentData.notes || "",
        status: "scheduled",
        createdVia: "internal",
        
        // Custom form data with properly wrapped standard questions
        customFields: appointmentData.customFields || {},
        bolExtractedData: appointmentData.bolExtractedData || null,
        bolFileUploaded: appointmentData.bolFileUploaded || false
      };
      
      console.log("Submitting formatted data for edit:", formattedData);
      appointmentMutation.mutate(formattedData);
      return;
    }
    
    // For new appointments, use same format as external booking endpoint
    const formattedData = {
      // Core appointment details
      facilityId: facilityId || appointmentData.facilityId,
      appointmentTypeId: appointmentTypeId || appointmentData.appointmentTypeId,
      pickupOrDropoff: appointmentData.pickupOrDropoff || "dropoff",
      startTime: appointmentData.startTime,
      endTime: appointmentData.endTime,
      dockId: initialDockId || appointmentData.dockId,
      
      // Company and contact details
      companyName: appointmentData.companyName,
      contactName: appointmentData.contactName,
      email: appointmentData.email,
      phone: appointmentData.phone,
      customerRef: appointmentData.customerRef || "",
      
      // Carrier and vehicle details
      carrierId: appointmentData.carrierId,
      carrierName: appointmentData.carrierName,
      driverName: appointmentData.driverName,
      driverPhone: appointmentData.driverPhone,
      driverEmail: appointmentData.driverEmail || appointmentData.email,
      mcNumber: appointmentData.mcNumber || "",
      truckNumber: appointmentData.truckNumber,
      trailerNumber: appointmentData.trailerNumber || "",
      
      // Additional details
      notes: appointmentData.notes || "",
      status: "scheduled",
      createdVia: "internal",
      
      // Custom form data
      customFields: appointmentData.customFields || {},
      bolExtractedData: appointmentData.bolExtractedData || null,
      bolFileUploaded: appointmentData.bolFileUploaded || false
    };
    
    console.log("Submitting formatted data:", formattedData);
    
    // Submit appointment using the external booking endpoint
    appointmentMutation.mutate(formattedData);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open: any) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editMode === 'edit' ? 'Edit Appointment' : 'Create New Appointment'}
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
            initialFacilityId={facilityId}
            initialAppointmentTypeId={appointmentTypeId}
            initialDate={initialDate}
            initialDockId={initialDockId}
            onSubmitSuccess={handleAppointmentSubmit}
            onCancel={onClose}
            internalMode={true}
          />
        </BookingWizardProvider>
      </DialogContent>
    </Dialog>
  );
}