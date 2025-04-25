import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Loader2, CalendarRange } from 'lucide-react';
import FullCalendarView from '@/components/calendar/full-calendar-view';
import { Schedule } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import AppointmentForm from '@/components/shared/appointment-form-fixed';

export default function CalendarPage() {
  const [, navigate] = useLocation();
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [dateSelectInfo, setDateSelectInfo] = useState<{
    start: Date;
    end: Date;
    allDay: boolean;
  } | null>(null);

  // Fetch schedules
  const { data: schedules, isLoading } = useQuery<Schedule[]>({
    queryKey: ['/api/schedules'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const handleEventClick = (scheduleId: number) => {
    setSelectedScheduleId(scheduleId);
  };

  const handleDateSelect = (selectInfo: { start: Date; end: Date; allDay: boolean }) => {
    setDateSelectInfo(selectInfo);
    setIsCreateModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <p className="text-muted-foreground">
          View and manage your dock appointments with timezone support
        </p>
      </div>

      {/* Custom view switcher */}
      <div className="flex justify-end space-x-2 mb-4">
        <div className="inline-flex rounded-md border">
          <Button
            variant="outline"
            size="sm"
            className="rounded-l-md rounded-r-none"
            onClick={() => {
              const calendar = document.querySelector('.fc') as any;
              if (calendar) {
                const api = calendar.__fullCalendar_instance.getApi();
                api.changeView('dayGridMonth');
              }
            }}
          >
            month
          </Button>
          <Button
            variant="default"
            size="sm"
            className="rounded-none border-l border-r"
            onClick={() => {
              const calendar = document.querySelector('.fc') as any;
              if (calendar) {
                const api = calendar.__fullCalendar_instance.getApi();
                api.changeView('timeGridWeek');
              }
            }}
          >
            week
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-none border-r"
            onClick={() => {
              const calendar = document.querySelector('.fc') as any;
              if (calendar) {
                const api = calendar.__fullCalendar_instance.getApi();
                api.changeView('timeGridDay');
              }
            }}
          >
            day
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-l-none rounded-r-md"
            onClick={() => {
              const calendar = document.querySelector('.fc') as any;
              if (calendar) {
                const api = calendar.__fullCalendar_instance.getApi();
                api.changeView('listWeek');
              }
            }}
          >
            list
          </Button>
        </div>
      </div>
      
      <FullCalendarView
        schedules={schedules || []}
        onEventClick={handleEventClick}
        onDateSelect={handleDateSelect}
      />

      {/* Appointment details dialog */}
      <Dialog open={!!selectedScheduleId} onOpenChange={(open) => !open && setSelectedScheduleId(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Appointment Details</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {selectedScheduleId && (
              <div className="space-y-4">
                <p>Appointment #{selectedScheduleId}</p>
                <Button
                  onClick={() => {
                    if (selectedScheduleId) {
                      navigate(`/schedules/${selectedScheduleId}/edit`);
                    }
                  }}
                >
                  Edit Appointment
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create appointment form directly in the dialog */}
      {dateSelectInfo && (
        <AppointmentForm
          mode="internal"
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          initialDate={dateSelectInfo.start}
          editMode="create"
          onSubmitSuccess={() => {
            setIsCreateModalOpen(false);
            setDateSelectInfo(null);
          }}
        />
      )}
    </div>
  );
}