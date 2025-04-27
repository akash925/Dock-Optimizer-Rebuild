import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Loader2, CalendarRange } from 'lucide-react';
import FullCalendarView from '@/components/calendar/full-calendar-view';
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
  
  // No external script loading - simplified approach
  
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

      {/* Controls row - all filters and controls */}
      <div className="view-buttons-container mb-6 sticky top-0 z-[1000] bg-white border rounded-lg shadow-sm" style={{
        position: "sticky",
        top: "0",
        zIndex: "1000",
        backgroundColor: "white",
        padding: "1.25rem",
        borderRadius: "0.5rem",
        marginBottom: "1.5rem"
      }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Timezone selector */}
          <div className="flex-col space-y-1">
            <Label htmlFor="timezone-select">Timezone</Label>
            <Select 
              value={selectedTimezone} 
              onValueChange={(timezone) => {
                setSelectedTimezone(timezone);
                // Fixed: Don't try to manipulate the calendar directly
                // The FullCalendarView component will handle the timezone change via props
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
                // We'll use a ref in FullCalendarView instead of direct DOM manipulation
                // For now, just refresh the page to avoid the error
                window.location.reload();
              }}
            >
              Today
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                // We'll use a ref in FullCalendarView instead of direct DOM manipulation
                // For now, just refresh the page to avoid the error
                window.location.reload();
              }}
            >
              Previous
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                // We'll use a ref in FullCalendarView instead of direct DOM manipulation
                // For now, just refresh the page to avoid the error
                window.location.reload();
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
                onClick={() => {
                  setCurrentView('dayGridMonth');
                  // We'll implement a better approach using a ref
                  // For now, just reload the page to avoid errors
                  window.location.reload();
                }}
              >
                month
              </Button>
              <Button
                variant={currentView === 'timeGridWeek' ? 'default' : 'outline'}
                size="sm"
                className="rounded-none border-l border-r calendar-view-button"
                onClick={() => {
                  setCurrentView('timeGridWeek');
                  // We'll implement a better approach using a ref
                  // For now, just reload the page to avoid errors
                  window.location.reload();
                }}
              >
                week
              </Button>
              <Button
                variant={currentView === 'timeGridDay' ? 'default' : 'outline'}
                size="sm"
                className="rounded-none border-r calendar-view-button"
                onClick={() => {
                  setCurrentView('timeGridDay');
                  // We'll implement a better approach using a ref
                  // For now, just reload the page to avoid errors
                  window.location.reload();
                }}
              >
                day
              </Button>
              <Button
                variant={currentView === 'listWeek' ? 'default' : 'outline'}
                size="sm"
                className="rounded-l-none rounded-r-md calendar-view-button"
                onClick={() => {
                  setCurrentView('listWeek');
                  // We'll implement a better approach using a ref
                  // For now, just reload the page to avoid errors
                  window.location.reload();
                }}
              >
                list
              </Button>
            </div>
          </div>
        </div>
        
        {/* Additional filters row */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-4 pt-4 border-t">
          {/* Facility filter */}
          <div className="flex-col space-y-1">
            <Label htmlFor="facility-select">Facility</Label>
            <Select defaultValue="all">
              <SelectTrigger id="facility-select" className="w-full">
                <SelectValue placeholder="All Facilities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Facilities</SelectItem>
                <SelectItem value="1">450 Airtech Pkwy</SelectItem>
                <SelectItem value="2">Camby Road</SelectItem>
                <SelectItem value="3">HANZO Cold-Chain</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Dock filter */}
          <div className="flex-col space-y-1">
            <Label htmlFor="dock-select">Dock</Label>
            <Select defaultValue="all">
              <SelectTrigger id="dock-select" className="w-full">
                <SelectValue placeholder="All Docks" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Docks</SelectItem>
                <SelectItem value="1">Dock #1</SelectItem>
                <SelectItem value="2">Dock #2</SelectItem>
                <SelectItem value="3">Dock #3</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Status filter */}
          <div className="flex-col space-y-1">
            <Label htmlFor="status-select">Status</Label>
            <Select defaultValue="all">
              <SelectTrigger id="status-select" className="w-full">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="checked-in">Checked In</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="canceled">Canceled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Type filter */}
          <div className="flex-col space-y-1">
            <Label htmlFor="type-select">Appointment Type</Label>
            <Select defaultValue="all">
              <SelectTrigger id="type-select" className="w-full">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="1">1 Hour Trailer Appointment</SelectItem>
                <SelectItem value="4">4 Hour Container Appointment</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Clear filters button */}
          <div className="flex items-end justify-end">
            <Button variant="outline" size="sm" className="mb-0.5">
              Clear Filters
            </Button>
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