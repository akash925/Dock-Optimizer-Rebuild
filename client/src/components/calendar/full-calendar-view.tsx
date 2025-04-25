import React, { useState, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import './full-calendar.css';
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
}

export function FullCalendarView({ 
  schedules, 
  onEventClick, 
  onDateSelect,
  timezone 
}: FullCalendarViewProps) {
  // Get user's timezone and set as default, or use the passed timezone prop
  const [selectedTimezone, setSelectedTimezone] = useState<string>(timezone || getUserTimeZone());
  
  // Update selectedTimezone when the timezone prop changes
  useEffect(() => {
    if (timezone) {
      setSelectedTimezone(timezone);
    }
  }, [timezone]);
  const calendarRef = useRef<FullCalendar>(null);
  
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
  const events: EventInput[] = schedules.map(schedule => {
    const isInbound = schedule.type === 'inbound';
    const statusColor = schedule.status === 'completed' ? '#4ADE80' : 
                      schedule.status === 'checked-in' ? '#F59E0B' :
                      schedule.status === 'canceled' ? '#EF4444' : 
                      schedule.status === 'no-show' ? '#6B7280' : 
                      (isInbound ? '#3B82F6' : '#10B981');
    
    // Format a more detailed title with relevant information
    let title = `${schedule.carrierName || 'Carrier'} | ${schedule.truckNumber || 'No Truck #'}`;
    
    // Add dock information if available
    if (schedule.dockName) {
      title += ` | ${schedule.dockName}`;
    }
    
    // Add status badge to title if not scheduled
    if (schedule.status && schedule.status !== 'scheduled') {
      title += ` | ${schedule.status.toUpperCase()}`;
    }
    
    return {
      id: schedule.id.toString(),
      title: title,
      start: schedule.startTime,
      end: schedule.endTime,
      backgroundColor: statusColor,
      borderColor: statusColor,
      textColor: '#FFFFFF',
      extendedProps: {
        type: schedule.type,
        carrierId: schedule.carrierId,
        dockId: schedule.dockId,
        status: schedule.status,
        dockName: schedule.dockName
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
  
  // Handle timezone change
  const handleTimezoneChange = (timezone: string) => {
    setSelectedTimezone(timezone);
    
    // Force calendar to re-render with new timezone
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.setOption('timeZone', timezone);
      // In newer versions of FullCalendar, render() has been removed
      // The calendar will automatically re-render when options change
    }
  };

  return (
    <div className="space-y-4">
      {/* Timezone selector */}
      <div className="flex items-end justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="flex-col space-y-1.5 w-64">
            <Label htmlFor="timezone-select">Timezone</Label>
            <Select 
              value={selectedTimezone} 
              onValueChange={handleTimezoneChange}
            >
              <SelectTrigger id="timezone-select">
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
        </div>
        
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              if (calendarRef.current) {
                calendarRef.current.getApi().today();
              }
            }}
          >
            Today
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              if (calendarRef.current) {
                calendarRef.current.getApi().prev();
              }
            }}
          >
            Previous
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              if (calendarRef.current) {
                calendarRef.current.getApi().next();
              }
            }}
          >
            Next
          </Button>
        </div>
      </div>
      
      <Card className="max-w-full">
        <CardContent className="p-4">
          <div className="calendar-container" style={{ height: "70vh", maxWidth: "100%", overflowY: "auto", overflowX: "hidden" }}>
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="timeGridWeek"
              headerToolbar={{
                left: 'dayGridMonth,timeGridWeek,timeGridDay',
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
              height="auto"
              contentHeight="auto"
              eventContent={(eventInfo) => {
                return (
                  <div className="w-full h-full p-1.5 flex flex-col justify-start overflow-hidden">
                    <div className="text-xs font-semibold mb-0.5">{eventInfo.timeText}</div>
                    <div className="text-xs font-medium line-clamp-2 overflow-hidden text-ellipsis">{eventInfo.event.title}</div>
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

export default FullCalendarView;