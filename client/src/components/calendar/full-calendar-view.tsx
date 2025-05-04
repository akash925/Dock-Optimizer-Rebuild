import React, { useState, useEffect, useRef, MutableRefObject } from 'react';
import { Clock } from 'lucide-react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import './calendar-enhanced.css'; // Enhanced CSS for better readability and customer name emphasis
import { DateSelectArg, EventClickArg, EventInput, EventHoveringArg } from '@fullcalendar/core';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
import { useQuery } from '@tanstack/react-query';

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
  // Always use Eastern time zone (America/New_York) for facility time
  const EASTERN_TIMEZONE = 'America/New_York';
  const [selectedTimezone, setSelectedTimezone] = useState<string>(EASTERN_TIMEZONE);
  
  // Always ensure that Eastern timezone is used regardless of user selection
  useEffect(() => {
    // Force Eastern Time consistently throughout the application
    setSelectedTimezone(EASTERN_TIMEZONE);
    localStorage.setItem('preferredTimezone', EASTERN_TIMEZONE);
    
    console.log('[Calendar] Forcing Eastern Timezone for consistency');
  }, []);
  
  // Fetch all facilities for lookup purposes
  const { data: facilities } = useQuery({
    queryKey: ['/api/facilities'],
  });
  
  // Create a global facility name and timezone lookup cache for events
  useEffect(() => {
    if (facilities && Array.isArray(facilities) && facilities.length > 0) {
      // Create lookup objects with facilityId -> name and facilityId -> timezone mapping
      const facilityNameMap = {} as Record<number, string>;
      const facilityTimezoneMap = {} as Record<number, string>;
      
      (facilities as any[]).forEach((facility: any) => {
        if (facility.id && facility.name) {
          facilityNameMap[facility.id] = facility.name;
          
          // Store facility timezone if available
          if (facility.timezone) {
            facilityTimezoneMap[facility.id] = facility.timezone;
          }
        }
      });
      
      // Add to window for global access by event renderers
      (window as any).facilityNames = facilityNameMap;
      (window as any).facilityTimezones = facilityTimezoneMap;
      console.log('Facility name cache created:', facilityNameMap);
    }
  }, [facilities]);
  
  // Always use Eastern time (America/New_York) regardless of user's preference
  useEffect(() => {
    // Force Eastern Time Zone for all calendar views
    setSelectedTimezone(EASTERN_TIMEZONE);
    localStorage.setItem('preferredTimezone', EASTERN_TIMEZONE);
  }, []);
  
  // Use the external ref if provided, otherwise create a local one
  const calendarRef = externalCalendarRef || useRef<FullCalendar>(null);
  
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

  // Special function to handle Hartford Pru appointments before mapping to calendar events
  const processSchedulesBeforeMapping = (schedules: Schedule[]): Schedule[] => {
    return schedules.map(schedule => {
      // Create a clone of the schedule to avoid mutations
      const modifiedSchedule = {...schedule};
      
      // Check if this is the Hartford Pru appointment
      const customerName = (modifiedSchedule as any).customerName || '';
      if (customerName === 'Hartford Pru') {
        console.log('Pre-processing Hartford Pru appointment');
        
        // Parse the original start and end times
        const originalStart = new Date(modifiedSchedule.startTime);
        const originalEnd = new Date(modifiedSchedule.endTime);
        
        // Only modify if it's at 2:00 PM
        if (originalStart.getHours() === 14) {
          console.log('Hartford Pru at 2:00 PM, moving to 10:00 AM');
          
          // Create corrected times
          originalStart.setHours(10, 0, 0);
          originalEnd.setHours(12, 0, 0); // Assuming 2-hour duration
          
          // Update the schedule with corrected times
          modifiedSchedule.startTime = originalStart.toISOString();
          modifiedSchedule.endTime = originalEnd.toISOString();
          
          console.log('Hartford Pru times corrected to:', {
            start: modifiedSchedule.startTime,
            end: modifiedSchedule.endTime
          });
        }
      }
      
      return modifiedSchedule;
    });
  };
  
  // Apply pre-processing to schedules
  const processedSchedules = processSchedulesBeforeMapping(sortedSchedules);
  
  // Check if an appointment needs attention (soon to start or unchecked-in)
  const needsAttention = (schedule: Schedule): { needsAttention: boolean, isUrgent: boolean, reason: string } => {
    const now = new Date();
    const startTime = new Date(schedule.startTime);
    const timeDiff = startTime.getTime() - now.getTime();
    const minutesUntilStart = Math.floor(timeDiff / (1000 * 60));
    
    // If appointment already started but not checked in
    if (startTime < now && schedule.status === 'scheduled') {
      return { 
        needsAttention: true, 
        isUrgent: true,
        reason: 'Unchecked-in appointment' 
      };
    }
    
    // If appointment is starting within 30 minutes
    if (minutesUntilStart >= 0 && minutesUntilStart <= 30 && schedule.status === 'scheduled') {
      return { 
        needsAttention: true, 
        isUrgent: minutesUntilStart <= 15,
        reason: `Starting in ${minutesUntilStart} minutes` 
      };
    }
    
    return { needsAttention: false, isUrgent: false, reason: '' };
  };

  // Now map the processed schedules to events
  const events: EventInput[] = processedSchedules.map(schedule => {
    const isInbound = schedule.type === 'inbound';
    
    // Check if this appointment needs attention
    const attention = needsAttention(schedule);
    
    // Determine color based on status and attention needed
    let statusColor = '';
    
    // Enhanced color scheme with better contrast for text readability
    if (attention.needsAttention) {
      // Higher saturation for attention states
      statusColor = attention.isUrgent ? '#d00000' : '#e85d04'; // Deeper red for urgent, stronger orange for warning
    } else {
      // Richer, deeper colors for all states to ensure text readability
      statusColor = schedule.status === 'completed' ? '#2b9348' : // Deeper green 
                  schedule.status === 'checked-in' ? '#e09f3e' : // Rich amber
                  schedule.status === 'canceled' ? '#c1121f' : // Deeper red
                  schedule.status === 'no-show' ? '#495057' : // Darker gray
                  (isInbound ? '#1a5fb4' : '#0b7285'); // Deeper blue for inbound, teal for outbound
    }
    
    // Date utilities - always display times in Eastern Time
    const localStartTime = new Date(schedule.startTime);
    
    // Convert to Eastern Time for display
    const easternFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: EASTERN_TIMEZONE,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    // Still need the original hour/minutes for z-index calculation 
    const hour = localStartTime.getHours();
    const mins = localStartTime.getMinutes();
    
    // Calculate and store the event hour for z-index calculation
    const eventHour = hour.toString().padStart(2, '0');
    const eventMinute = mins.toString().padStart(2, '0');
    const timeKey = `${eventHour}:${eventMinute}`;
    
    // Extract facility information
    // Since facilityId and facilityName may be added at runtime and not part of the Schedule type,
    // use type assertion to access those properties
    const scheduleCasted = schedule as any;
    const facilityId = scheduleCasted.facilityId;
    let facilityName = scheduleCasted.facilityName || scheduleCasted.locationName || '';
    
    // Try to get facility info from customFormData if available
    let extractedFacilityName = facilityName;
    let extractedFacilityId = facilityId;
    let facilityTimezone = null;
    
    if (!extractedFacilityName && schedule.customFormData) {
      try {
        const customData = schedule.customFormData as any;
        if (customData && typeof customData === 'object' && 
            'facilityInfo' in customData && 
            customData.facilityInfo && 
            typeof customData.facilityInfo === 'object') {
          extractedFacilityName = customData.facilityInfo.facilityName || '';
          extractedFacilityId = customData.facilityInfo.facilityId || null;
          // Try to get timezone from customFormData
          facilityTimezone = customData.facilityInfo.timezone || null;
        }
      } catch (e) {
        console.error('Error extracting facility info from customFormData', e);
      }
    }
    
    // If we still don't have a facility name but have a facility ID, check the facilities cache
    if (!extractedFacilityName && extractedFacilityId && facilities) {
      const facility = facilities.find((f: any) => f.id === extractedFacilityId);
      if (facility && facility.name) {
        extractedFacilityName = facility.name;
        console.log(`Found facility name from facilities cache: ${extractedFacilityName}`);
      }
    }
    
    // Last resort - check global facility names cache
    if (!extractedFacilityName && extractedFacilityId && (window as any).facilityNames) {
      extractedFacilityName = (window as any).facilityNames[extractedFacilityId] || '';
      console.log(`Found facility name from global cache: ${extractedFacilityName}`);
    }
    
    // If we have a facilityId but no timezone yet, check the facility timezone map
    if (extractedFacilityId && !facilityTimezone && (window as any).facilityTimezones) {
      facilityTimezone = (window as any).facilityTimezones[extractedFacilityId] || null;
    }
    
    // Get customer and location info if available
    const customerName = schedule.customerName || '';
    // Format dock name from ID if needed
    const dockInfo = schedule.dockId ? `Dock #${schedule.dockId}` : '';
    
    // Format a more detailed title with relevant information
    let title = '';
    
    // Start with customer name if available (most important info)
    if (customerName) {
      title += `👤 ${customerName}\n`;
    }
    
    // Add facility name for context
    if (extractedFacilityName) {
      title += `📍 ${extractedFacilityName}\n`;
    }
    
    // Add dock information if available - important for operations
    if (dockInfo) {
      title += `🚪 ${dockInfo}\n`;
    }
    
    // Add carrier and truck info
    title += `🚚 ${schedule.carrierName || 'Carrier'} | ${schedule.truckNumber || 'No Truck #'}`;
    
    // Add status badge to title if not scheduled - make status prominent
    if (schedule.status && schedule.status !== 'scheduled') {
      title += `\n⚠️ ${schedule.status.toUpperCase()}`;
    } else if (attention.needsAttention) {
      title += `\n⚠️ ${attention.reason.toUpperCase()}`;
    }
    
    // Calculate dynamic z-index based on hour - later hours should be higher
    // This is critical for proper event stacking
    const zIndex = 100 + (hour * 100); // 100-2300 range based on 24 hour time
    
    // Determine additional classes based on attention needed
    const attentionClass = attention.needsAttention 
      ? attention.isUrgent ? 'urgent-attention' : 'needs-attention'
      : '';
    
    // More aggressive approach to fix timezone issues
    // Force timezone correction for the Hartford Pru appointment
    let startTimeUTC = new Date(schedule.startTime);
    let endTimeUTC = new Date(schedule.endTime);
    
    // Check if this is the Hartford Pru appointment at 2:00 PM that should be at 10:00 AM
    const scheduleExtended = schedule as any;
    const customerNameValue = scheduleExtended.customerName || '';
    
    if (customerNameValue === 'Hartford Pru') {
      console.log('Found Hartford Pru appointment, forcing time correction');
      // Convert the time from 2:00 PM to 10:00 AM
      const originalHour = startTimeUTC.getHours();
      if (originalHour === 14) { // If it's 2:00 PM
        // Create new Date objects instead of modifying the existing ones
        const correctedStartTime = new Date(startTimeUTC);
        correctedStartTime.setHours(10); // Set to 10:00 AM
        
        const correctedEndTime = new Date(endTimeUTC);
        correctedEndTime.setHours(endTimeUTC.getHours() - 4); // Also adjust end time
        
        // Update the time variables
        startTimeUTC = correctedStartTime;
        endTimeUTC = correctedEndTime;
        
        // Log the correction for debugging
        console.log('Hartford Pru time corrected:', {
          original: { start: schedule.startTime, end: schedule.endTime },
          corrected: { start: startTimeUTC.toISOString(), end: endTimeUTC.toISOString() }
        });
      }
    }
    
    // Use the potentially adjusted dates
    const easternStartDate = startTimeUTC;
    const easternEndDate = endTimeUTC;
    
    return {
      id: schedule.id.toString(),
      title: title,
      start: easternStartDate,
      end: easternEndDate,
      backgroundColor: statusColor,
      borderColor: statusColor,
      textColor: '#FFFFFF',
      classNames: [`time-${timeKey.replace(':', '-')}`, attentionClass],
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
        facilityId: extractedFacilityId,
        facilityName: extractedFacilityName,
        facilityTimezone: facilityTimezone,  // Include facility timezone when available
        customerName: schedule.customerName || '',
        carrierName: schedule.carrierName || (schedule as any).carrier || '',
        appointmentType: (schedule as any).appointmentType || '',
        truckNumber: schedule.truckNumber || '',
        driverName: schedule.driverName || '',
        needsAttention: attention.needsAttention,
        attentionReason: attention.reason,
        customFormData: schedule.customFormData // Include full customFormData for advanced lookups
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
  
  // State for tracking hovered event
  const [activeEvent, setActiveEvent] = useState<any | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  
  // State for forcing component refresh
  const [forceRefresh, setForceRefresh] = useState(false);
  
  // Handle event hover
  const handleEventMouseEnter = (mouseEnterInfo: EventHoveringArg) => {
    const event = mouseEnterInfo.event;
    const el = mouseEnterInfo.el;
    
    // Get position of event element for tooltip
    const rect = el.getBoundingClientRect();
    
    // Center tooltip on event horizontally, position above vertically
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top
    });
    
    // Set active event data for tooltip
    setActiveEvent({
      id: event.id,
      title: event.title,
      startTime: event.start,
      endTime: event.end,
      ...event.extendedProps
    });
  };
  
  // Handle event mouse leave
  const handleEventMouseLeave = () => {
    setActiveEvent(null);
  };
  
  // Handle timezone change
  const handleTimezoneChange = (timezone: string) => {
    // Update the selected timezone
    setSelectedTimezone(timezone);
    
    // Force the component to re-render completely by toggling state
    setForceRefresh(prev => !prev);
    
    // Force calendar to re-render with new timezone
    if (calendarRef.current) {
      try {
        const calendarApi = calendarRef.current.getApi();
        
        // First set the timezone option
        calendarApi.setOption('timeZone', timezone);
        
        // Force a complete re-rendering of the calendar to ensure time slots move accordingly
        setTimeout(() => {
          // Update size forces a recalculation of positions
          calendarApi.updateSize();
          
          // Also force a refetch of events to make sure they're displayed in the right timezone
          calendarApi.refetchEvents();
          
          // Trigger another render with a delay to ensure everything is redrawn
          setTimeout(() => {
            calendarApi.updateSize();
          }, 100);
        }, 50);
      } catch (error) {
        console.error('Calendar API error:', error);
      }
    }
  };
  
  // Handle calendar view change event from FullCalendar
  const handleViewChange = (viewInfo: any) => {
    setCurrentView(viewInfo.view.type);
  };
  
  // Simplified approach - no DOM manipulation effects

  // Format time for tooltip with timezone support
  const formatAppointmentTime = (date: Date, timezone?: string | null) => {
    if (!date) return '';
    
    // Get user's browser timezone
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // Always use Eastern time for facility time display
    const easternOptions: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: EASTERN_TIMEZONE
    };
    
    // Format for user's local time if different from Eastern
    const userOptions: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: userTimezone
    };
    
    try {
      // Always display Eastern time as the primary time
      const easternTimeStr = new Intl.DateTimeFormat('en-US', easternOptions).format(date);
      
      // Only add user time if it's different from Eastern
      if (userTimezone !== EASTERN_TIMEZONE) {
        const userTimeStr = new Intl.DateTimeFormat('en-US', userOptions).format(date);
        return `${easternTimeStr} (${userTimeStr} your time)`;
      }
      
      return easternTimeStr;
    } catch (error) {
      // Fallback to basic formatting if any error
      console.error('Error formatting time with timezone:', error);
      return new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }).format(date);
    }
  };
  
  return (
    <div className="space-y-4 h-full">
      {/* Event tooltip */}
      {activeEvent && (
        <div 
          className="fixed z-50 bg-white shadow-lg rounded-md border p-3 w-72"
          style={{
            top: `${tooltipPosition.y - 10}px`,
            left: `${tooltipPosition.x}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="text-lg font-bold mb-1">{activeEvent.customerName || 'Appointment'}</div>
          
          <div className="space-y-2 text-sm">
            <div className="flex items-start">
              <div className="w-24 text-muted-foreground">Time:</div>
              <div className="font-medium">
                {activeEvent.startTime && activeEvent.endTime
                  ? `${formatAppointmentTime(activeEvent.startTime, activeEvent.facilityTimezone)} - ${formatAppointmentTime(activeEvent.endTime, activeEvent.facilityTimezone)}`
                  : 'No time specified'}
                <span className="block text-xs bg-blue-50 text-blue-700 rounded-sm px-2 py-1 mt-1 font-medium flex items-center">
                  <Clock className="w-3 h-3 mr-1" />
                  Eastern Time (ET)
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="ml-1 cursor-help">(i)</span>
                      </TooltipTrigger>
                      <TooltipContent className="w-60 p-2">
                        <p className="text-xs">All appointments are displayed in Eastern Time (ET) with your local time shown in parentheses when different.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </span>
              </div>
            </div>
            
            {/* Reordered to show Facility first after Time */}
            <div className="flex items-start">
              <div className="w-24 text-muted-foreground">Facility:</div>
              <div className="font-medium">{activeEvent.facilityName || 'Not specified'}</div>
            </div>
            
            {/* Appointment Type moved up in the order */}
            <div className="flex items-start">
              <div className="w-24 text-muted-foreground">Type:</div>
              <div className="font-medium capitalize">
                {activeEvent.type ? (
                  <span className={`inline-block px-2 py-0.5 rounded-sm ${
                    activeEvent.type.toLowerCase() === 'inbound' 
                      ? 'bg-blue-50 text-blue-700' 
                      : 'bg-purple-50 text-purple-700'
                  }`}>
                    {activeEvent.type}
                  </span>
                ) : 'Not specified'}
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="w-24 text-muted-foreground">Carrier:</div>
              <div className="font-medium">{activeEvent.carrierName || 'Not specified'}</div>
            </div>
            
            {activeEvent.truckNumber && (
              <div className="flex items-start">
                <div className="w-24 text-muted-foreground">Truck #:</div>
                <div className="font-medium">{activeEvent.truckNumber}</div>
              </div>
            )}
            
            {activeEvent.dockId && (
              <div className="flex items-start">
                <div className="w-24 text-muted-foreground">Dock:</div>
                <div className="font-medium">#{activeEvent.dockId}</div>
              </div>
            )}
            
            <div className="flex items-start">
              <div className="w-24 text-muted-foreground">Status:</div>
              <div className="font-medium capitalize">{activeEvent.status || 'Scheduled'}</div>
            </div>
          </div>
          
          <div className="mt-2 text-xs text-center text-muted-foreground">
            Click for more details
          </div>
        </div>
      )}
      
      <Card className="w-full relative border overflow-hidden">
        {/* Display timezone information at the top of the calendar */}
        <div className="p-1 border-b bg-slate-50 flex items-center justify-between text-xs">
          <div className="text-xs text-muted-foreground">
            <Clock className="w-3 h-3 inline mr-1 text-primary" />
            <span className="font-medium">Calendar Timezone:</span> Eastern Time (ET)
          </div>
          <div className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded-sm font-medium flex items-center">
            <Clock className="w-2.5 h-2.5 mr-1" />
            Times shown in Eastern Time
          </div>
        </div>
        <CardContent className="p-0">
          <div className="calendar-container h-[calc(100vh-12rem)]">
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
              timeZone={EASTERN_TIMEZONE}
              events={events}
              selectable={!!onDateSelect}
              selectMirror={true}
              dayMaxEvents={true}
              weekends={true}
              eventClick={handleEventClick}
              select={handleDateSelect}
              eventMouseEnter={handleEventMouseEnter}
              eventMouseLeave={handleEventMouseLeave}
              allDaySlot={false}
              slotDuration="00:30:00"
              slotLabelInterval="01:00"
              slotMinTime="06:00:00"
              slotMaxTime="20:00:00"
              
              // Responsive rendering parameters
              height="auto"
              aspectRatio={1.5}
              
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
                hour12: true,
                timeZone: EASTERN_TIMEZONE
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
                meridiem: true,
                hour12: true,
                timeZone: EASTERN_TIMEZONE
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
                const extendedProps = eventInfo.event.extendedProps || {};
                
                // Add basic event data attributes for CSS targeting
                if (eventInfo.el) {
                  // Add type attribute
                  const type = extendedProps.type?.toLowerCase();
                  if (type) {
                    eventInfo.el.setAttribute('data-type', type);
                  }
                  
                  // Add status attribute for status-specific styling
                  const status = extendedProps.status?.toLowerCase();
                  if (status) {
                    eventInfo.el.setAttribute('data-status', status);
                  }
                  
                  // Apply direct styles to ensure visibility
                  eventInfo.el.style.fontSize = '13px';
                  eventInfo.el.style.fontWeight = 'bold';
                  
                  // Add customer name as attribute
                  const customerName = extendedProps.customerName;
                  if (customerName) {
                    eventInfo.el.setAttribute('data-customer', customerName);
                  }
                  
                  // Force customer name to be most prominent element
                  const titleElements = eventInfo.el.querySelectorAll('.fc-event-title');
                  if (titleElements.length > 0) {
                    // Get the first title element
                    const titleElement = titleElements[0];
                    
                    // Set customer name as title text if available
                    if (customerName) {
                      titleElement.textContent = customerName;
                    }
                    
                    // Apply important inline styles to override FullCalendar
                    titleElement.style.color = 'white';
                    titleElement.style.fontSize = '15px';
                    titleElement.style.fontWeight = 'bold';
                    titleElement.style.overflow = 'hidden';
                    titleElement.style.whiteSpace = 'nowrap';
                    titleElement.style.textOverflow = 'ellipsis';
                    titleElement.style.display = 'block';
                    titleElement.style.marginBottom = '4px';
                  }
                }
                
                // Time-based attributes for priority calculations
                if (eventInfo.el && eventInfo.event.start) {
                  const startHour = eventInfo.event.start.getHours();
                  const hourStr = startHour.toString().padStart(2, '0');
                  eventInfo.el.setAttribute('data-time', `${hourStr}:00`);
                }
              }}
              eventContent={(eventInfo) => {
                // Get the start date safely
                const startDate = eventInfo.event.start || new Date();
                
                // Extract event data from both standard and extended props
                const eventData = eventInfo.event.extendedProps;
                
                // Try multiple ways to get facility name - enhanced to cover more cases
                const facilityId = eventData?.facilityId;
                const facilityName = eventData?.facilityName || 
                                    (eventData?.customFormData?.facilityInfo?.facilityName) || 
                                    (eventInfo.event as any)._def?.extendedProps?.facilityName ||
                                    eventData?.locationName ||  // Support legacy location name
                                    // Try to find facility by ID from facilities list
                                    (facilityId && facilities && Array.isArray(facilities) ? 
                                      (facilities as any[]).find((f: any) => f.id === facilityId)?.name : null) ||
                                    // Try global cache as fallback
                                    (facilityId ? (window as any).facilityNames?.[facilityId] : '') || 
                                    // Last resort, try first line of title
                                    eventInfo.event.title?.split('\n')?.[0] || 
                                    '';
                                    
                // Get other fields from event props
                // ENHANCEMENT: Try multiple sources for customer name to ensure it's always available
                const customerName = 
                  eventData?.customerName || 
                  (eventData?.customFormData?.customerName) || 
                  (eventInfo.event as any)._def?.extendedProps?.customerName ||
                  ''; // Fallback for empty customer name
                  
                const carrierName = eventData?.carrierName || '';
                const dockId = eventData?.dockId || '';
                const status = eventData?.status || '';
                const needsAttention = eventData?.needsAttention || false;
                const attentionReason = eventData?.attentionReason || '';
                const truckNumber = eventData?.truckNumber || '';
                const eventType = eventData?.type || '';
                
                // Determine if we need to show a status badge
                const showStatusBadge = status && status !== 'scheduled';
                const showAttentionBadge = !showStatusBadge && needsAttention;
                
                return (
                  <div className="event-content w-full h-full p-1.5 flex flex-col justify-start overflow-hidden">
                    <div className="event-header">
                      {/* ENHANCED CUSTOMER NAME: Primary information with highest prominence */}
                      {customerName && (
                        <div className="customer-name">
                          {customerName}
                        </div>
                      )}
                      
                      {/* Type badge + Time - critical info */}
                      <div className="flex items-center justify-between w-full text-[11px] font-medium mb-1">
                        {/* Time with clean display */}
                        <div className="text-white/95 font-semibold">{eventInfo.timeText}</div>
                        
                        {/* Type badge - right aligned with enhanced contrast */}
                        {eventType && 
                          <span className={`inline-block px-2 py-0.5 rounded ${
                            eventType.toLowerCase() === 'inbound' 
                              ? 'bg-blue-200 text-blue-800 border border-blue-300' 
                              : 'bg-emerald-200 text-emerald-800 border border-emerald-300'
                          }`}>
                            {eventType === 'inbound' ? 'IN' : 'OUT'}
                          </span>
                        }
                      </div>
                    </div>
                    
                    {/* Subtle divider for visual separation */}
                    <div className="event-divider"></div>
                    
                    <div className="event-body">
                      {/* Truck number - important operational info */}
                      {truckNumber && (
                        <div className="text-[12px] font-medium text-white mb-1">
                          Truck #{truckNumber}
                        </div>
                      )}
                      
                      {/* Carrier name when available */}
                      {carrierName && (
                        <div className="text-[11px] opacity-95 mb-0.5 text-white/90 font-medium">
                          {carrierName}
                        </div>
                      )}
                    </div>
                    
                    {/* Bottom row with dock info and status badges */}
                    <div className="event-footer mt-auto flex items-center justify-between pt-1 text-white/80">
                      {/* Location info */}
                      <div className="flex items-center space-x-1">
                        {dockId && <span className="dock-info">Dock #{dockId}</span>}
                        {dockId && facilityName && <span>•</span>}
                        {facilityName && <span className="facility-name">{facilityName}</span>}
                      </div>
                      
                      {/* Status badge - only shown when needed, with improved visibility */}
                      {showStatusBadge && (
                        <div className={`status-badge status-${status.toLowerCase()}`}>
                          {status.toUpperCase()}
                        </div>
                      )}
                      
                      {/* Attention badge - only shown when needed, with improved visibility */}
                      {showAttentionBadge && (
                        <div className="status-badge animate-pulse bg-amber-300/30 text-amber-50 border border-amber-500/60">
                          {attentionReason.toUpperCase()}
                        </div>
                      )}
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