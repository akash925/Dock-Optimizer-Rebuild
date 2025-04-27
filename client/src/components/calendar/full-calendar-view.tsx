import React, { useState, useEffect, useRef, MutableRefObject } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import './calendar-clean.css'; // One clean CSS file with all needed fixes
import { DateSelectArg, EventClickArg, EventInput } from '@fullcalendar/core';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Schedule } from '@shared/schema';
import { getUserTimeZone, getTimeZoneAbbreviation } from '@/lib/timezone-utils';

// List of common timezones that we know are supported by FullCalendar
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

interface FullCalendarViewProps {
  schedules: Schedule[];
  onEventClick: (scheduleId: number) => void;
  onDateSelect?: (selectInfo: { start: Date; end: Date; allDay: boolean }) => void;
  timezone?: string; // Add timezone prop
  calendarRef?: React.RefObject<FullCalendar>;
  initialView?: string;
}

// Export a function for the parent component to get the calendar reference
// Removed separate function export to avoid conflicts with Fast Refresh

export default function FullCalendarView({ 
  schedules, 
  onEventClick, 
  onDateSelect,
  timezone,
  calendarRef: externalCalendarRef,
  initialView: initialViewProp = 'timeGridWeek'
}: FullCalendarViewProps) {
  // Get user's timezone and set as default, or use the passed timezone prop
  const [selectedTimezone, setSelectedTimezone] = useState<string>(timezone || getUserTimeZone());
  
  // Update selectedTimezone when the timezone prop changes
  useEffect(() => {
    if (timezone) {
      setSelectedTimezone(timezone);
    }
  }, [timezone]);
  // Use the external ref if provided, otherwise create a local one
  const calendarRef = externalCalendarRef || useRef<FullCalendar>(null);
  
  // Save timezone preference to localStorage
  useEffect(() => {
    // Load saved timezone preference if it exists
    const savedTimezone = localStorage.getItem('preferredTimezone');
    if (savedTimezone) {
      setSelectedTimezone(savedTimezone);
    }
  }, []);
  
  // Save timezone preference when it changes
  useEffect(() => {
    localStorage.setItem('preferredTimezone', selectedTimezone);
  }, [selectedTimezone]);
  
  // Convert schedules to FullCalendar event format
  // First sort schedules so that later times come first, which ensures they'll be rendered first
  // and earlier events will overlay them (reverse chronological for the day)
  const sortedSchedules = [...schedules].sort((a, b) => {
    const aStartTime = new Date(a.startTime);
    const bStartTime = new Date(b.startTime);
    // First check if they're the same day
    if (aStartTime.toDateString() === bStartTime.toDateString()) {
      // For events on the same day, sort by hour in DESCENDING order (later events first)
      return bStartTime.getHours() - aStartTime.getHours();
    }
    // For events on different days, sort normally (chronologically)
    return aStartTime.getTime() - bStartTime.getTime();
  });

  // Now map the sorted schedules to events
  const events: EventInput[] = sortedSchedules.map(schedule => {
    const isInbound = schedule.type === 'inbound';
    const statusColor = schedule.status === 'completed' ? '#4ADE80' : 
                      schedule.status === 'checked-in' ? '#F59E0B' :
                      schedule.status === 'canceled' ? '#EF4444' : 
                      schedule.status === 'no-show' ? '#6B7280' : 
                      (isInbound ? '#3B82F6' : '#10B981');
    
    // Date utilities
    const startTime = new Date(schedule.startTime);
    const hour = startTime.getHours();
    const mins = startTime.getMinutes();
    
    // Calculate and store the event hour for z-index calculation
    const eventHour = hour.toString().padStart(2, '0');
    const eventMinute = mins.toString().padStart(2, '0');
    const timeKey = `${eventHour}:${eventMinute}`;
    
    // Get customer and location info if available
    const customerName = schedule.customerName || '';
    // Format dock name from ID if needed
    const dockInfo = schedule.dockId ? `Dock #${schedule.dockId}` : '';
    
    // Format a more detailed title with relevant information
    let title = '';
    
    // Add customer name if available
    if (customerName) {
      title += `${customerName}\n`;
    }
    
    // Add carrier and truck info
    title += `${schedule.carrierName || 'Carrier'} | ${schedule.truckNumber || 'No Truck #'}`;
    
    // Add dock information if available
    if (dockInfo) {
      title += `\n${dockInfo}`;
    }
    
    // Add status badge to title if not scheduled
    if (schedule.status && schedule.status !== 'scheduled') {
      title += `\n${schedule.status.toUpperCase()}`;
    }
    
    // Calculate dynamic z-index based on hour - later hours should be higher
    // This is critical for proper event stacking
    const zIndex = 100 + (hour * 100); // 100-2300 range based on 24 hour time
    
    return {
      id: schedule.id.toString(),
      title: title,
      start: schedule.startTime,
      end: schedule.endTime,
      backgroundColor: statusColor,
      borderColor: statusColor,
      textColor: '#FFFFFF',
      classNames: [`time-${timeKey.replace(':', '-')}`],
      // The critical part: assign z-index directly to the event
      zIndex: zIndex,
      extendedProps: {
        type: schedule.type,
        carrierId: schedule.carrierId,
        dockId: schedule.dockId,
        status: schedule.status,
        timeKey: timeKey,
        hourKey: eventHour,
        zIndex: zIndex,
        // Additional data for improved display
        facilityName: (schedule as any).facilityName || (schedule as any).locationName || '',
        customerName: schedule.customerName || '',
        carrierName: schedule.carrierName || (schedule as any).carrier || '',
        appointmentType: (schedule as any).appointmentType || '',
        truckNumber: schedule.truckNumber || '',
        driverName: schedule.driverName || ''
      }
    };
  });
  
  // Handle event click
  const handleEventClick = (clickInfo: EventClickArg) => {
    const scheduleId = parseInt(clickInfo.event.id);
    onEventClick(scheduleId);
  };
  
  // Handle date selection
  const handleDateSelect = (selectInfo: DateSelectArg) => {
    if (onDateSelect) {
      onDateSelect({
        start: selectInfo.start,
        end: selectInfo.end,
        allDay: selectInfo.allDay
      });
    }
  };
  
  // State to track current calendar view
  const [currentView, setCurrentView] = useState<string>('timeGridWeek');
  
  // Handle timezone change
  const handleTimezoneChange = (timezone: string) => {
    setSelectedTimezone(timezone);
    
    // Force calendar to re-render with new timezone
    if (calendarRef.current) {
      try {
        const calendarApi = calendarRef.current.getApi();
        calendarApi.setOption('timeZone', timezone);
      } catch (error) {
        console.log('Calendar API not available yet, timezone will be applied on next render');
        // Will rely on the props change to update the timezone
      }
    }
  };
  
  // Handle calendar view change event from FullCalendar
  const handleViewChange = (viewInfo: any) => {
    setCurrentView(viewInfo.view.type);
  };
  
  // Simplified approach - no DOM manipulation effects

  return (
    <div className="space-y-4">
      <Card className="w-full relative border overflow-hidden">
        <CardContent className="p-0">
          <div className="calendar-container" style={{ 
            height: "70vh",
            width: "100%",
            maxWidth: "100%",
            overflow: "hidden"
          }}>
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
              initialView={initialViewProp}
              headerToolbar={{
                left: '',
                center: 'title',
                right: ''
              }}
              nowIndicator={true}
              timeZone={selectedTimezone}
              events={events}
              selectable={!!onDateSelect}
              selectMirror={true}
              dayMaxEvents={true}
              weekends={true}
              eventClick={handleEventClick}
              select={handleDateSelect}
              allDaySlot={false}
              slotDuration="00:30:00"
              slotLabelInterval="01:00"
              slotMinTime="06:00:00"
              slotMaxTime="20:00:00"
              
              // Fixed rendering parameters
              height="auto"
              contentHeight={650}
              
              // View settings
              titleFormat={{
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              }}
              
              // Column header format using newer API
              slotLabelFormat={{
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              }}
              
              // More stable settings
              fixedWeekCount={false}
              navLinks={false}
              handleWindowResize={false}
              moreLinkClick="popover"
              
              // Event display options
              eventDisplay="block"
              eventTimeFormat={{
                hour: '2-digit',
                minute: '2-digit',
                meridiem: false,
                hour12: false
              }}
              
              // Event sorting - later ones on top
              eventOrder="start" 
              
              // Disable overlap to avoid stacking issues
              eventOverlap={false}
              
              // Force event duration for better display
              forceEventDuration={true}
              
              // Capture view change
              viewDidMount={handleViewChange}
              
              // Simple DOM setup without complex manipulation
              eventDidMount={(eventInfo) => {
                // Just set the data attribute for styling
                if (eventInfo.el && eventInfo.event.start) {
                  const startHour = eventInfo.event.start.getHours();
                  const hourStr = startHour.toString().padStart(2, '0');
                  eventInfo.el.setAttribute('data-time', `${hourStr}:00`);
                }
              }}
              eventContent={(eventInfo) => {
                // Get the start date safely
                const startDate = eventInfo.event.start || new Date();
                
                // Extract event data
                const eventData = eventInfo.event.extendedProps;
                const facilityName = eventData?.facilityName || '';
                const customerName = eventData?.customerName || '';
                const carrierName = eventData?.carrierName || '';
                const dockId = eventData?.dockId || '';
                
                return (
                  <div className="w-full h-full p-1.5 flex flex-col justify-start overflow-hidden">
                    <div className="text-xs font-semibold mb-0.5">{eventInfo.timeText}</div>
                    <div className="text-xs font-medium line-clamp-1 overflow-hidden text-ellipsis">
                      {facilityName && <span className="font-bold block text-[11px] text-blue-700">{facilityName}</span>}
                      {customerName && <span className="font-semibold block">{customerName}</span>}
                    </div>
                    <div className="text-[10px] text-gray-700 line-clamp-2 overflow-hidden">
                      {carrierName && <span className="block">{carrierName}</span>}
                      {dockId && <span className="block">Dock #{dockId}</span>}
                    </div>
                  </div>
                );
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}