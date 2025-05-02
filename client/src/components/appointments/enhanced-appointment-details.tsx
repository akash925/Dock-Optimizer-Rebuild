import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Schedule } from '@shared/schema';
import { AppointmentDetailsDialog } from '@/components/schedules/appointment-details-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
    facilityName,
    facilityTimezone,
    dockName: schedule.dockId ? `Dock #${schedule.dockId}` : undefined,
    appointmentTypeName: scheduleCasted.appointmentTypeName
  };

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