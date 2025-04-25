import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Loader2, CalendarRange } from 'lucide-react';
import FullCalendarView from '@/components/calendar/full-calendar-view';
import '@/components/calendar/direct-dom-fix.js'; // Import direct DOM fix script
import { Schedule } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { getUserTimeZone, getTimeZoneAbbreviation } from '@/lib/timezone-utils';
import AppointmentForm from '@/components/shared/appointment-form-fixed';

// List of common timezones
const COMMON_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'UTC',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Australia/Sydney'
];

export default function CalendarPage() {
  const [, navigate] = useLocation();
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [currentView, setCurrentView] = useState<string>('timeGridWeek');
  const [selectedTimezone, setSelectedTimezone] = useState<string>(getUserTimeZone());
  const [dateSelectInfo, setDateSelectInfo] = useState<{
    start: Date;
    end: Date;
    allDay: boolean;
  } | null>(null);
  
  // Add the external fix script to the document
  useEffect(() => {
    const script = document.createElement('script');
    script.src = '/calendar-direct-fix.js';
    script.async = true;
    document.body.appendChild(script);
    
    return () => {
      // Clean up on unmount
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);
  
  // Save and load timezone preference from localStorage
  useEffect(() => {
    const savedTimezone = localStorage.getItem('preferredTimezone');
    if (savedTimezone) {
      setSelectedTimezone(savedTimezone);
    }
  }, []);
  
  useEffect(() => {
    localStorage.setItem('preferredTimezone', selectedTimezone);
  }, [selectedTimezone]);

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

      {/* Controls row - timezone selector, view switcher and navigation */}
      <div className="view-buttons-container mb-4 sticky top-0 z-[1000] bg-white border-b pb-4" style={{
        position: "sticky",
        top: "0",
        zIndex: "1000",
        backgroundColor: "white",
        padding: "1rem 0",
        borderBottom: "1px solid #e5e7eb"
      }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {/* Timezone selector */}
          <div className="flex-col space-y-1">
            <Label htmlFor="timezone-select">Timezone</Label>
            <Select 
              value={selectedTimezone} 
              onValueChange={(timezone) => {
                setSelectedTimezone(timezone);
                const calendar = document.querySelector('.fc') as any;
                if (calendar) {
                  const api = calendar.__fullCalendar_instance.getApi();
                  api.setOption('timeZone', timezone);
                }
              }}
            >
              <SelectTrigger id="timezone-select" className="w-full md:w-64">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={getUserTimeZone()}>
                  Local: {getUserTimeZone()} ({getTimeZoneAbbreviation(getUserTimeZone())})
                </SelectItem>
                {COMMON_TIMEZONES.filter(tz => tz !== getUserTimeZone()).map(timezone => (
                  <SelectItem key={timezone} value={timezone}>
                    {timezone} ({getTimeZoneAbbreviation(timezone)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Today, prev, next buttons */}
          <div className="flex items-end justify-center space-x-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                const calendar = document.querySelector('.fc') as any;
                if (calendar) {
                  const api = calendar.__fullCalendar_instance.getApi();
                  api.today();
                }
              }}
            >
              Today
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                const calendar = document.querySelector('.fc') as any;
                if (calendar) {
                  const api = calendar.__fullCalendar_instance.getApi();
                  api.prev();
                }
              }}
            >
              Previous
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                const calendar = document.querySelector('.fc') as any;
                if (calendar) {
                  const api = calendar.__fullCalendar_instance.getApi();
                  api.next();
                }
              }}
            >
              Next
            </Button>
          </div>
          
          {/* Custom view switcher */}
          <div className="flex items-end justify-end">
            <div className="inline-flex rounded-md border">
              <Button
                variant={currentView === 'dayGridMonth' ? 'default' : 'outline'}
                size="sm"
                className="rounded-l-md rounded-r-none calendar-view-button"
                style={{display: "block", visibility: "visible", opacity: 1}}
                onClick={() => {
                  setCurrentView('dayGridMonth');
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
                variant={currentView === 'timeGridWeek' ? 'default' : 'outline'}
                size="sm"
                className="rounded-none border-l border-r calendar-view-button"
                style={{display: "block", visibility: "visible", opacity: 1}}
                onClick={() => {
                  setCurrentView('timeGridWeek');
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
                variant={currentView === 'timeGridDay' ? 'default' : 'outline'}
                size="sm"
                className="rounded-none border-r calendar-view-button"
                style={{display: "block", visibility: "visible", opacity: 1}}
                onClick={() => {
                  setCurrentView('timeGridDay');
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
                variant={currentView === 'listWeek' ? 'default' : 'outline'}
                size="sm"
                className="rounded-l-none rounded-r-md calendar-view-button"
                style={{display: "block", visibility: "visible", opacity: 1}}
                onClick={() => {
                  setCurrentView('listWeek');
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
        </div>
      </div>
      
      <FullCalendarView
        schedules={schedules || []}
        onEventClick={handleEventClick}
        onDateSelect={handleDateSelect}
        timezone={selectedTimezone}
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