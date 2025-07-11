import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Loader2, CalendarRange } from 'lucide-react';
import EnhancedCalendarView from '@/components/calendar/enhanced-calendar-view';
import FullCalendar from '@fullcalendar/react';
import { Schedule } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { getUserTimeZone, getTimeZoneAbbreviation } from '@shared/timezone-service';
import AppointmentForm from '@/components/shared/unified-appointment-form';
import AppointmentDetails from '@/components/calendar/appointment-details';
import { WebSocketStatus } from '@/components/shared/websocket-status';
import { useRealtimeUpdates } from '@/hooks/use-realtime-updates';

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

// Generate a consistent color for a facility based on its ID
const getFacilityColor = (facilityId: number | null): string => {
  if (!facilityId) {
    return '#6b7280'; // Gray for no facility
  }
  
  // Define a consistent color palette for facilities
  const facilityColors = [
    '#3b82f6', // Blue
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#8b5cf6', // Violet
    '#06b6d4', // Cyan
    '#84cc16', // Lime
    '#f97316', // Orange
    '#ec4899', // Pink
    '#14b8a6', // Teal
    '#6366f1', // Indigo
    '#a855f7', // Purple
  ];
  
  // Use facility ID to consistently assign colors
  const colorIndex = facilityId % facilityColors.length;
  return facilityColors[colorIndex];
};

export default function CalendarPage() {
  const [, navigate] = useLocation();
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [currentView, setCurrentView] = useState<string>('timeGridWeek');
  const [selectedTimezone, setSelectedTimezone] = useState<string>(getUserTimeZone());
  const calendarRef = useRef<FullCalendar>(null);
  const [dateSelectInfo, setDateSelectInfo] = useState<{
    start: Date;
    end: Date;
    allDay: boolean;
  } | null>(null);
  
  // No external script loading - simplified approach
  
  // Check for scheduleId in URL and open that appointment detail
  useEffect(() => {
    // Get scheduleId from URL parameters
    const params = new URLSearchParams(window.location.search);
    const scheduleId = params.get('scheduleId');
    
    if (scheduleId) {
      const numericId = parseInt(scheduleId, 10);
      if (!isNaN(numericId)) {
        setSelectedScheduleId(numericId);
      }
    }
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

  // Fetch facilities
  const { data: facilities, isLoading: isLoadingFacilities } = useQuery({
    queryKey: ['/api/facilities'],
  });

  // Fetch schedules
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>("all");
  const [selectedDockId, setSelectedDockId] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  
  // Initialize real-time WebSocket connection for live updates
  const { connected: wsConnected, socketError } = useRealtimeUpdates();

  // With WebSockets enabled, we can reduce the polling interval or disable it
  // when the WebSocket connection is active
  const { data: schedules, isLoading: isLoadingSchedules, refetch: refetchSchedules } = useQuery<Schedule[]>({
    queryKey: ['/api/schedules'],
    // When WebSocket is connected, we can set a longer interval
    // When not connected, fallback to more frequent polling
    refetchInterval: wsConnected ? 60000 : 15000, // 60s with WebSocket, 15s without
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  // Fetch appointment types
  const { data: appointmentTypes } = useQuery({
    queryKey: ['/api/appointment-types'],
  });

  // Filter schedules based on selected options
  const filteredSchedules = React.useMemo(() => {
    if (!schedules) return [];
    
    return schedules.filter(schedule => {
      // Filter by facility
      if (selectedFacilityId !== "all") {
        // Check if we have facilityId from the schedule
        // Use type assertion to handle the facilityId property that might be added by the API
        const extendedSchedule = schedule as any;
        const facilityId = extendedSchedule.facilityId;
        
        // If not directly available, try to get it from customFormData
        let scheduleFacilityId = facilityId;
        
        if (!scheduleFacilityId && schedule.customFormData) {
          // Safely access nested properties with type checks
          const customData = schedule.customFormData as any;
          if (customData && typeof customData === 'object' && 
              'facilityInfo' in customData && 
              customData.facilityInfo && 
              typeof customData.facilityInfo === 'object' &&
              'facilityId' in customData.facilityInfo) {
            scheduleFacilityId = customData.facilityInfo.facilityId;
          }
        }
        
        if (!scheduleFacilityId || scheduleFacilityId.toString() !== selectedFacilityId) {
          return false;
        }
      }
      
      // Filter by dock
      if (selectedDockId !== "all" && 
          (!schedule.dockId || schedule.dockId.toString() !== selectedDockId)) {
        return false;
      }
      
      // Filter by status
      if (selectedStatus !== "all" && schedule.status !== selectedStatus) {
        return false;
      }
      
      // Filter by appointment type
      if (selectedType !== "all" && 
          (!schedule.appointmentTypeId || 
           schedule.appointmentTypeId.toString() !== selectedType)) {
        return false;
      }
      
      return true;
    });
  }, [schedules, selectedFacilityId, selectedDockId, selectedStatus, selectedType]);

  const handleEventClick = (scheduleId: number) => {
    setSelectedScheduleId(scheduleId);
  };

  const handleDateSelect = (selectInfo: { start: Date; end: Date; allDay: boolean }) => {
    setDateSelectInfo(selectInfo);
    setIsCreateModalOpen(true);
  };

  if (isLoadingFacilities || isLoadingSchedules) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-1 px-2">
      {/* ENHANCED: Compact header for maximum screen usage */}
      <div className="mb-1 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Calendar</h1>
          <p className="text-muted-foreground text-xs">
            View and manage dock appointments
          </p>
        </div>
        
        {/* WebSocket connection status indicator */}
        <WebSocketStatus />
      </div>

      {/* ENHANCED: Ultra-compact controls for maximum calendar space */}
      <div className="view-buttons-container mb-1 sticky top-0 z-[1000] bg-white/95 backdrop-blur-sm border rounded-lg shadow-sm" style={{
        position: "sticky",
        top: "0",
        zIndex: "10",
        backgroundColor: "rgba(255, 255, 255, 0.95)",
        padding: "0.5rem",
        borderRadius: "0.5rem",
        marginBottom: "0.25rem"
      }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Timezone selector */}
          <div className="flex-col space-y-1">
            <Label htmlFor="timezone-select" className="text-xs">Timezone</Label>
            <Select 
              value={selectedTimezone} 
              onValueChange={(timezone) => {
                setSelectedTimezone(timezone);
                // Fixed: Don't try to manipulate the calendar directly
                // The FullCalendarView component will handle the timezone change via props
              }}
            >
              <SelectTrigger id="timezone-select" className="w-full md:w-56 z-10 h-8 text-xs">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" className="z-50 w-[280px]" align="start">
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
          <div className="flex items-end justify-center space-x-1">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                if (calendarRef.current) {
                  try {
                    const api = calendarRef.current.getApi();
                    api.today();
                  } catch (error) {
                    console.error('Error navigating to today:', error);
                  }
                }
              }}
              className="h-8 px-2 text-xs"
            >
              Today
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                if (calendarRef.current) {
                  try {
                    const api = calendarRef.current.getApi();
                    api.prev();
                  } catch (error) {
                    console.error('Error navigating to previous:', error);
                  }
                }
              }}
              className="h-8 px-2 text-xs"
            >
              ←
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                if (calendarRef.current) {
                  try {
                    const api = calendarRef.current.getApi();
                    api.next();
                  } catch (error) {
                    console.error('Error navigating to next:', error);
                  }
                }
              }}
              className="h-8 px-2 text-xs"
            >
              →
            </Button>
          </div>
          
          {/* Custom view switcher */}
          <div className="flex items-end justify-end">
            <div className="inline-flex rounded-md border">
              <Button
                variant={currentView === 'dayGridMonth' ? 'default' : 'outline'}
                size="sm"
                className="rounded-l-md rounded-r-none calendar-view-button h-8 px-2 text-xs"
                onClick={() => {
                  if (calendarRef.current) {
                    try {
                      const api = calendarRef.current.getApi();
                      api.changeView('dayGridMonth');
                      setCurrentView('dayGridMonth');
                    } catch (error) {
                      console.error('Error changing to month view:', error);
                    }
                  }
                }}
              >
                Month
              </Button>
              <Button
                variant={currentView === 'timeGridWeek' ? 'default' : 'outline'}
                size="sm"
                className="rounded-none border-l border-r calendar-view-button h-8 px-2 text-xs"
                onClick={() => {
                  if (calendarRef.current) {
                    try {
                      const api = calendarRef.current.getApi();
                      api.changeView('timeGridWeek');
                      setCurrentView('timeGridWeek');
                    } catch (error) {
                      console.error('Error changing to week view:', error);
                    }
                  }
                }}
              >
                Week
              </Button>
              <Button
                variant={currentView === 'timeGridDay' ? 'default' : 'outline'}
                size="sm"
                className="rounded-none border-r calendar-view-button h-8 px-2 text-xs"
                onClick={() => {
                  if (calendarRef.current) {
                    try {
                      const api = calendarRef.current.getApi();
                      api.changeView('timeGridDay');
                      setCurrentView('timeGridDay');
                    } catch (error) {
                      console.error('Error changing to day view:', error);
                    }
                  }
                }}
              >
                Day
              </Button>
              <Button
                variant={currentView === 'listWeek' ? 'default' : 'outline'}
                size="sm"
                className="rounded-l-none rounded-r-md calendar-view-button h-8 px-2 text-xs"
                onClick={() => {
                  if (calendarRef.current) {
                    try {
                      const api = calendarRef.current.getApi();
                      api.changeView('listWeek');
                      setCurrentView('listWeek');
                    } catch (error) {
                      console.error('Error changing to list view:', error);
                    }
                  }
                }}
              >
                List
              </Button>
            </div>
          </div>
        </div>
        
        {/* ENHANCED: Compact additional filters row */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mt-3 pt-3 border-t">
          {/* Facility filter */}
          <div className="flex-col space-y-1">
            <Label htmlFor="facility-select" className="text-xs">Facility</Label>
            <Select 
              value={selectedFacilityId} 
              onValueChange={setSelectedFacilityId}
            >
              <SelectTrigger id="facility-select" className="w-full z-10 h-8 text-xs">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="start" className="z-50">
                <SelectItem value="all">All Facilities</SelectItem>
                {Array.isArray(facilities) && facilities.map((facility: any) => (
                  <SelectItem key={facility.id} value={facility.id.toString()}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: getFacilityColor(facility.id) }}
                      />
                      <span>{facility.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Dock filter */}
          <div className="flex-col space-y-1">
            <Label htmlFor="dock-select" className="text-xs">Dock</Label>
            <Select 
              value={selectedDockId}
              onValueChange={setSelectedDockId}
            >
              <SelectTrigger id="dock-select" className="w-full z-10 h-8 text-xs">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="start" className="z-50">
                <SelectItem value="all">All Docks</SelectItem>
                <SelectItem value="1">Dock #1</SelectItem>
                <SelectItem value="2">Dock #2</SelectItem>
                <SelectItem value="3">Dock #3</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Status filter */}
          <div className="flex-col space-y-1">
            <Label htmlFor="status-select" className="text-xs">Status</Label>
            <Select 
              value={selectedStatus}
              onValueChange={setSelectedStatus}
            >
              <SelectTrigger id="status-select" className="w-full z-10 h-8 text-xs">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="start" className="z-50">
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
            <Label htmlFor="type-select" className="text-xs">Type</Label>
            <Select 
              value={selectedType}
              onValueChange={setSelectedType}
            >
              <SelectTrigger id="type-select" className="w-full z-10 h-8 text-xs">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="start" className="z-50">
                <SelectItem value="all">All Types</SelectItem>
                {Array.isArray(appointmentTypes) && appointmentTypes.map((type: any) => (
                  <SelectItem key={type.id} value={type.id.toString()}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Clear filters button */}
          <div className="flex items-end justify-start md:col-span-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 px-3 text-xs"
              onClick={() => {
                setSelectedFacilityId("all");
                setSelectedDockId("all");
                setSelectedStatus("all");
                setSelectedType("all");
              }}
            >
              Clear Filters
            </Button>
          </div>
        </div>
      </div>
      
      {/* ENHANCED: Calendar with maximum screen real estate */}
      <EnhancedCalendarView
        schedules={filteredSchedules}
        onEventClick={handleEventClick}
        onDateSelect={handleDateSelect}
        timezone={selectedTimezone}
        calendarRef={calendarRef}
        initialView={currentView}
      />

      {/* Appointment details dialog - using the enhanced component */}
      <AppointmentDetails 
        scheduleId={selectedScheduleId} 
        onClose={() => setSelectedScheduleId(null)} 
      />

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