import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Schedule } from '@shared/schema';
import { AppointmentDetailsDialog } from '@/components/schedules/appointment-details-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Use the same ExtendedSchedule interface from appointment-details-dialog.tsx
interface ExtendedSchedule {
  id: number;
  dockId: number | null;
  carrierId: number | null;
  appointmentTypeId: number;
  startTime: string;
  endTime: string;
  status: string;
  type: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  lastModifiedAt?: string;
  createdBy: number | null;
  lastModifiedBy: number | null;
  truckNumber: string;
  trailerNumber: string | null;
  driverName: string | null;
  driverPhone?: string | null;
  driverEmail?: string | null;
  customerName?: string;
  carrierName?: string;
  dockName?: string;
  appointmentTypeName?: string;
  facilityName?: string;
  facilityId?: number | null;
  facilityTimezone?: string;
  confirmationCode?: string;
  bolNumber?: string | null;
  bolDocumentPath?: string | null;
  customFormData?: any;
  bolDocuments?: any[];
  weight?: string | null;
  palletCount?: string | null;
  mcNumber?: string | null;
  actualStartTime?: string;
  actualEndTime?: string;
  poNumber?: string | null;
  appointmentMode?: string;
  creatorEmail?: string | null;
}

interface EnhancedAppointmentDetailsProps {
  scheduleId: number | null;
  onClose: () => void;
}

export default function EnhancedAppointmentDetails({ scheduleId, onClose }: EnhancedAppointmentDetailsProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(!!scheduleId);

  // Update dialog state when scheduleId changes
  useEffect(() => {
    setIsDialogOpen(!!scheduleId);
  }, [scheduleId]);

  // Handle dialog close
  const handleOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      onClose();
    }
  };

  // Fetch appointment data
  const { data: schedule, isLoading } = useQuery<Schedule>({
    queryKey: [`/api/schedules/${scheduleId}`],
    enabled: !!scheduleId,
  });

  if (isLoading || !schedule) {
    return (
      <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Appointment Details</DialogTitle>
          </DialogHeader>
          <div className="py-6 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Get facility name from the schedule
  const scheduleCasted = schedule as any;
  const facilityName = scheduleCasted.facilityName || 
                     (scheduleCasted.customFormData?.facilityInfo?.facilityName) || 
                     'No facility assigned';
  
  // Extract timezone from schedule data if available
  const facilityTimezone = scheduleCasted.facilityTimezone || 
                         (scheduleCasted.customFormData?.facilityInfo?.timezone) || 
                         'America/New_York'; // Default to Eastern time

  // Convert schedule to the expected format for AppointmentDetailsDialog
  const extendedSchedule = {
    ...schedule,
    // Convert Date objects to ISO strings
    startTime: schedule.startTime.toISOString(),
    endTime: schedule.endTime.toISOString(),
    createdAt: schedule.createdAt.toISOString(),
    updatedAt: schedule.lastModifiedAt?.toISOString() || schedule.createdAt.toISOString(),
    lastModifiedAt: schedule.lastModifiedAt?.toISOString(),
    lastModifiedBy: schedule.createdBy, // Map createdBy to lastModifiedBy
    actualStartTime: schedule.actualStartTime?.toISOString(),
    actualEndTime: schedule.actualEndTime?.toISOString(),
    // Add additional properties
    facilityName,
    facilityTimezone,
    dockName: schedule.dockId ? `Dock #${schedule.dockId}` : undefined,
    appointmentTypeName: scheduleCasted.appointmentTypeName,
    truckNumber: schedule.truckNumber || ''
  } as ExtendedSchedule;

  return (
    <AppointmentDetailsDialog
      appointment={extendedSchedule}
      open={isDialogOpen}
      onOpenChange={handleOpenChange}
      facilityName={facilityName}
      timezone={facilityTimezone}
      timeFormat="12h"
    />
  );
}