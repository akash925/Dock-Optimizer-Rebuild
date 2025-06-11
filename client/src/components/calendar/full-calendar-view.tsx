import React, { useState, useEffect, useRef, MutableRefObject } from 'react';
import { Clock } from 'lucide-react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import './calendar-master.css'; // NEW: Single consolidated CSS file
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
import { 
  getUserTimeZone, 
  getTimeZoneAbbreviation, 
  formatForDualTimeZoneDisplay,
  formatTimeRangeForDualZones 
} from '@/lib/timezone-utils';
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
  facilityId?: number; // Add facilityId to fetch facility timezone
}

// Export a function for the parent component to get the calendar reference
// Removed separate function export to avoid conflicts with Fast Refresh

export default function FullCalendarView({ 
  schedules, 
  onEventClick, 
  onDateSelect,
  timezone,
  calendarRef: externalCalendarRef,
  initialView: initialViewProp = 'timeGridWeek',
  facilityId
}: FullCalendarViewProps) {
  // ENHANCED: Dynamic timezone handling based on facility
  const [selectedTimezone, setSelectedTimezone] = useState<string | null>(null);
  const [effectiveTimezone, setEffectiveTimezone] = useState<string>(getUserTimeZone());
  
  // Fetch facility data to get the correct timezone
  const { data: facility } = useQuery({
    queryKey: [`/api/facilities/${facilityId}`],
    queryFn: async () => {
      if (!facilityId) return null;
      const response = await fetch(`/api/facilities/${facilityId}`);
      if (!response.ok) throw new Error('Failed to fetch facility');
      return response.json();
    },
    enabled: !!facilityId
  });

  // Fetch all facilities for lookup purposes
  const { data: facilities } = useQuery({
    queryKey: ['/api/facilities'],
  });
  
  // ENHANCED: Set effective timezone based on facility or user preference
  useEffect(() => {
    let targetTimezone = getUserTimeZone(); // Default to user timezone
    
    // Priority 1: Explicitly passed timezone prop
    if (timezone) {
      targetTimezone = timezone;
    }
    // Priority 2: Facility timezone from facility data
    else if (facility?.timezone) {
      targetTimezone = facility.timezone;
    }
    // Priority 3: Selected timezone from user preference
    else if (selectedTimezone) {
      targetTimezone = selectedTimezone;
    }
    // Priority 4: Try to get facility timezone from schedules
    else if (schedules.length > 0) {
      // Look for facility timezone from the schedules
      const scheduleWithFacility = schedules.find(s => (s as any).facilityTimezone);
      if (scheduleWithFacility) {
        targetTimezone = (scheduleWithFacility as any).facilityTimezone;
      }
    }
    
    setEffectiveTimezone(targetTimezone);
    
    console.log('[Calendar] Timezone Resolution:', {
      userTimezone: getUserTimeZone(),
      propTimezone: timezone,
      facilityTimezone: facility?.timezone,
      selectedTimezone,
      effectiveTimezone: targetTimezone,
      facilityId
    });
  }, [timezone, facility, selectedTimezone, schedules, facilityId]);
  
  // Add state to track calendar readiness
  const [calendarReady, setCalendarReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
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
      console.log('Facility timezone cache created:', facilityTimezoneMap);
    }
  }, [facilities]);
  
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
  const events: EventInput[] = sortedSchedules.map(schedule => {
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
    
    // Date utilities - use effective timezone for display
    const localStartTime = new Date(schedule.startTime);
    
    // Convert to effective timezone for display
    const effectiveFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: effectiveTimezone,
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
    if (!extractedFacilityName && extractedFacilityId && facilities && Array.isArray(facilities)) {
      const facility = (facilities as any[]).find((f: any) => f.id === extractedFacilityId);
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
    
    // Start with customer name if available (most important info) - ENHANCED FOR VISIBILITY
    if (customerName) {
      title = customerName; // Simplified title for better display
    } else {
      title = 'Unnamed Appointment'; // Fallback when no customer name
    }
    
    // Calculate dynamic z-index based on hour - later hours should be higher
    // This is critical for proper event stacking
    const zIndex = 100 + (hour * 100); // 100-2300 range based on 24 hour time
    
    // Determine additional classes based on attention needed
    const attentionClass = attention.needsAttention 
      ? attention.isUrgent ? 'urgent-attention' : 'needs-attention'
      : '';
    
    // Use the potentially adjusted dates
    const easternStartDate = new Date(schedule.startTime);
    const easternEndDate = new Date(schedule.endTime);
    
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

  // Format time for tooltip with timezone support
  const formatAppointmentTime = (date: Date, timezone?: string | null) => {
    if (!date) return '';
    
    // Get user's browser timezone
    const userTimezone = getUserTimeZone();
    const targetTimezone = timezone || effectiveTimezone;
    
    // Use the dual timezone formatting utility
    const { userTime, facilityTime, userZone, facilityZone } = formatForDualTimeZoneDisplay(
      date, 
      targetTimezone, 
      'h:mm a'
    );
      
    // Only show user time if it's different from facility time
    if (userTimezone !== targetTimezone) {
      return `${facilityTime} (${userTime} your time)`;
      }
      
    return facilityTime;
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
                  {getTimeZoneAbbreviation(effectiveTimezone)} Time
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="ml-1 cursor-help">(i)</span>
                      </TooltipTrigger>
                      <TooltipContent className="w-60 p-2">
                        <p className="text-xs">All appointments are displayed in the facility's timezone with your local time shown in parentheses when different.</p>
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
            <span className="font-medium">Calendar Timezone:</span> {getTimeZoneAbbreviation(effectiveTimezone)} ({effectiveTimezone.split('/').pop()?.replace('_', ' ')})
          </div>
          <div className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded-sm font-medium flex items-center">
            <Clock className="w-2.5 h-2.5 mr-1" />
            Times shown in {getTimeZoneAbbreviation(effectiveTimezone)}
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
              timeZone={effectiveTimezone}
              events={events}
              selectable={!!onDateSelect}
              selectMirror={true}
              dayMaxEvents={4}
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
              
              // ENHANCED: Responsive rendering parameters optimized for day view
              height="auto"
              aspectRatio={currentView === 'timeGridDay' ? 1.8 : 1.35} // Taller aspect ratio for day view
              handleWindowResize={true}
              
              // ENHANCED: View-specific configurations
              views={{
                timeGridDay: {
                  titleFormat: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' },
                  slotLabelFormat: { hour: 'numeric', minute: '2-digit', hour12: true },
                  eventTimeFormat: { hour: 'numeric', minute: '2-digit', hour12: true },
                  slotDuration: '00:30:00',
                  slotLabelInterval: '01:00',
                  snapDuration: '00:15:00', // Snap events to 15-minute intervals
                  dayMaxEvents: false, // Show all events in day view
                  dayMaxEventRows: false,
                  moreLinkClick: 'day'
                },
                timeGridWeek: {
                  slotDuration: '00:30:00',
                  slotLabelInterval: '01:00',
                  dayMaxEvents: 3,
                  moreLinkClick: 'day'
                },
                dayGridMonth: {
                  dayMaxEvents: 2,
                  moreLinkClick: 'day',
                  fixedWeekCount: false
                }
              }}
              
              // ENHANCED: View settings with improved responsiveness
              titleFormat={{
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              }}
              
              // ENHANCED: More stable settings for better month/day view display
              fixedWeekCount={false}
              navLinks={false}
              moreLinkClick="popover"
              
              // ENHANCED: Event display options with improved stacking
              eventDisplay="block"
              eventTimeFormat={{
                hour: '2-digit',
                minute: '2-digit',
                meridiem: 'short',
                hour12: true,
                timeZone: effectiveTimezone
              }}
              
              // ENHANCED: Event sorting and overlap management for better day view
              eventOrder="start,-duration,allDay,title" 
              eventOverlap={true}
              eventConstraint="businessHours"
              
              // ENHANCED: Force event duration for better display
              forceEventDuration={true}
              defaultTimedEventDuration="00:30:00"
              
              // ENHANCED: Better loading and refresh management
              loading={(isLoading) => {
                console.log('[FullCalendar] Loading state changed:', isLoading);
                setIsLoading(isLoading);
              }}
              
              // ENHANCED: Capture view change with better error handling
              viewDidMount={(viewInfo) => {
                console.log('[FullCalendar] View mounted:', viewInfo.view.type);
                handleViewChange(viewInfo);
                setCalendarReady(true);
              }}
              
              // ENHANCED: Better resource management for events
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
                  (eventInfo.el as HTMLElement).style.fontSize = '13px';
                  (eventInfo.el as HTMLElement).style.fontWeight = 'bold';
                  
                  // Add customer name as attribute
                  const customerName = extendedProps.customerName;
                  if (customerName) {
                    eventInfo.el.setAttribute('data-customer', customerName);
                  }
                  
                  // Force customer name to be most prominent element
                  const titleElements = eventInfo.el.querySelectorAll('.fc-event-title');
                  if (titleElements.length > 0) {
                    // Get the first title element
                    const titleElement = titleElements[0] as HTMLElement;
                    
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
                // Get the start date and end date
                const startDate = eventInfo.event.start || new Date();
                const endDate = eventInfo.event.end || new Date();
                
                // Calculate event duration in minutes
                const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));
                
                // Determine if this is a short event (1 hour or less)
                const isShortEvent = durationMinutes <= 60;
                
                // For very short events (30 minutes or less), use ultra-compact layout
                const isUltraShortEvent = durationMinutes <= 30;
                
                // Extract event data from both standard and extended props
                const eventData = eventInfo.event.extendedProps;
                
                // ENHANCED: Priority customer name extraction with multiple fallbacks
                const customerName = 
                  eventData?.customerName || 
                  (eventData?.customFormData?.customerName) || 
                  (eventInfo.event as any)._def?.extendedProps?.customerName ||
                  // Try extracting from title as last resort
                  eventInfo.event.title?.split('\n')?.[0]?.replace('👤 ', '') ||
                  'Customer'; // Always provide fallback
                  
                // Get other fields from event props
                const carrierName = eventData?.carrierName || 'Carrier';
                const dockId = eventData?.dockId || '';
                const status = eventData?.status || '';
                const needsAttention = eventData?.needsAttention || false;
                const attentionReason = eventData?.attentionReason || '';
                const truckNumber = eventData?.truckNumber || '';
                const eventType = eventData?.type || '';
                
                // Determine if we need to show a status badge
                const showStatusBadge = status && status !== 'scheduled';
                const showAttentionBadge = !showStatusBadge && needsAttention;
                
                // Dynamic class names based on event duration
                const eventContentClass = `event-content w-full h-full flex flex-col justify-start overflow-hidden ${isUltraShortEvent ? 'p-1' : isShortEvent ? 'p-1.5' : 'p-2'}`;
                
                // For ultra-short events, show only customer name prominently
                if (isUltraShortEvent) {
                  return (
                    <div className={eventContentClass}>
                      <div className="w-full text-center">
                        <div className="text-white font-bold text-sm leading-tight overflow-hidden">
                          {customerName}
                        </div>
                        <div className="text-white/80 text-xs mt-0.5">
                          {eventInfo.timeText}
                        </div>
                      </div>
                    </div>
                  );
                }
                
                // For short events, use simplified layout focused on customer name
                if (isShortEvent) {
                  return (
                    <div className={`${eventContentClass} short-event`}>
                      <div className="w-full">
                        {/* PROMINENT CUSTOMER NAME - largest text */}
                        <div className="text-white font-bold text-base leading-tight mb-1 overflow-hidden text-ellipsis">
                          {customerName}
                        </div>
                        
                        {/* Secondary info in smaller text */}
                        <div className="text-white/90 text-xs flex justify-between items-center">
                          <span>{eventInfo.timeText}</span>
                          {eventType && 
                            <span className="font-semibold">
                              {eventType === 'inbound' ? 'IN' : 'OUT'}
                            </span>
                          }
                        </div>
                        
                        {/* Truck info if available */}
                        {truckNumber && (
                          <div className="text-white/80 text-xs mt-0.5">
                            Truck #{truckNumber}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }
                
                // For normal events, use the full layout with customer name first
                return (
                  <div className={eventContentClass}>
                    <div className="event-header">
                      {/* ENHANCED CUSTOMER NAME: Largest, most prominent display */}
                      <div className="customer-name-primary text-white font-bold text-lg leading-tight mb-2 overflow-hidden text-ellipsis">
                          {customerName}
                        </div>
                      
                      {/* Time and Type - secondary info */}
                      <div className="flex items-center justify-between w-full text-sm font-medium mb-1">
                        <div className="time-display text-white/90">{eventInfo.timeText}</div>
                        
                        {eventType && 
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
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
                    <div className="w-full h-px bg-white/20 my-1"></div>
                    
                    <div className="event-body flex-1">
                      {/* Truck number - important operational info */}
                      {truckNumber && (
                        <div className="text-sm font-medium text-white mb-1">
                          🚚 Truck #{truckNumber}
                        </div>
                      )}
                      
                      {/* Carrier name when available */}
                      {carrierName && carrierName !== 'Carrier' && (
                        <div className="text-sm text-white/90 mb-1">
                          {carrierName}
                        </div>
                      )}
                      
                      {/* Dock info */}
                      {dockId && (
                        <div className="text-sm text-white/80">
                          🚪 Dock #{dockId}
                        </div>
                      )}
                      </div>
                      
                    {/* Status badges at bottom */}
                    <div className="event-footer mt-auto pt-1">
                      {showStatusBadge && (
                        <div className={`text-xs px-2 py-1 rounded font-bold ${
                          status === 'completed' ? 'bg-green-200 text-green-800' :
                          status === 'checked-in' ? 'bg-yellow-200 text-yellow-800' :
                          status === 'canceled' ? 'bg-red-200 text-red-800' :
                          'bg-gray-200 text-gray-800'
                        }`}>
                          {status.toUpperCase()}
                        </div>
                      )}
                      
                      {showAttentionBadge && (
                        <div className="text-xs px-2 py-1 rounded font-bold bg-amber-200 text-amber-800 animate-pulse">
                          ⚠️ {attentionReason.toUpperCase()}
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