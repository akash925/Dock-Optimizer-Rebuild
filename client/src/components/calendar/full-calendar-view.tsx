import React, { useState, useEffect, useRef, MutableRefObject } from 'react';
import { Clock } from 'lucide-react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import './responsive-calendar.css'; // NEW: Responsive CSS that fixes label overflow
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
  timezoneService,
  getUserTimeZone, 
  getTimeZoneAbbreviation, 
  formatForDualTimeZoneDisplay,
  getCommonTimezones 
} from '@shared/timezone-service';
import { useQuery } from '@tanstack/react-query';

// Get common timezones from the centralized timezone service
const COMMON_TIMEZONES = getCommonTimezones().map(tz => tz.value);

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
    
    // Reduced logging for stability - only log in development
    if (import.meta.env.MODE === 'development') {
      console.log('[Calendar] Timezone Resolution:', {
        userTimezone: getUserTimeZone(),
        propTimezone: timezone,
        facilityTimezone: facility?.timezone,
        selectedTimezone,
        effectiveTimezone: targetTimezone,
        facilityId
      });
    }
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
      
      // Only log in development
      if (import.meta.env.MODE === 'development') {
        console.log('Facility name cache created:', facilityNameMap);
        console.log('Facility timezone cache created:', facilityTimezoneMap);
      }
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
        // Reduced logging for stability
        if (import.meta.env.MODE === 'development') {
          console.error('Error extracting facility info from customFormData', e);
        }
      }
    }
    
    // If we still don't have a facility name but have a facility ID, check the facilities cache
    if (!extractedFacilityName && extractedFacilityId && facilities && Array.isArray(facilities)) {
      const facility = (facilities as any[]).find((f: any) => f.id === extractedFacilityId);
      if (facility && facility.name) {
        extractedFacilityName = facility.name;
        if (import.meta.env.MODE === 'development') {
          console.log(`Found facility name from facilities cache: ${extractedFacilityName}`);
        }
      }
    }
    
    // Last resort - check global facility names cache
    if (!extractedFacilityName && extractedFacilityId && (window as any).facilityNames) {
      extractedFacilityName = (window as any).facilityNames[extractedFacilityId] || '';
      if (import.meta.env.MODE === 'development' && extractedFacilityName) {
        console.log(`Found facility name from global cache: ${extractedFacilityName}`);
      }
    }
    
    // If we have a facilityId but no timezone yet, check the facility timezone map
    if (extractedFacilityId && !facilityTimezone && (window as any).facilityTimezones) {
      facilityTimezone = (window as any).facilityTimezones[extractedFacilityId] || null;
    }
    
    // Get customer and location info if available
    const customerName = schedule.customerName || '';
    // Format dock name from ID if needed
    const dockInfo = schedule.dockId ? `Dock #${schedule.dockId}` : '';
    
    // ENHANCED: Format a more detailed title with Customer and Facility prominently displayed
    let title = '';
    
    // Primary: Customer Name (most important)
    if (customerName) {
      title = customerName;
      // Add facility name if available and different
      if (extractedFacilityName && extractedFacilityName !== customerName) {
        title += ` @ ${extractedFacilityName}`;
      }
    } else if (extractedFacilityName) {
      // Secondary: Facility name if no customer name
      title = `Appointment @ ${extractedFacilityName}`;
    } else {
      // Fallback
      title = 'Appointment';
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
    <div className="space-y-2 h-full">
      {/* ENHANCED Event tooltip with Customer Name and Facility Name prominently displayed */}
      {activeEvent && (
        <div 
          className="fixed z-50 bg-white shadow-xl rounded-lg border p-4 w-80 max-w-sm"
          style={{
            top: `${tooltipPosition.y - 10}px`,
            left: `${tooltipPosition.x}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          {/* ENHANCED: Customer Name prominently displayed as header */}
          <div className="text-xl font-bold mb-2 text-gray-900 border-b pb-2">
            {activeEvent.customerName || 'Appointment'}
          </div>
          
          <div className="space-y-3 text-sm">
            {/* ENHANCED: Facility Name prominently displayed */}
            {activeEvent.facilityName && (
              <div className="flex items-start">
                <div className="w-20 text-gray-600 font-medium">Facility:</div>
                <div className="font-semibold text-blue-700 flex-1">
                  {activeEvent.facilityName}
                </div>
              </div>
            )}
            
            {/* Time with enhanced display */}
            <div className="flex items-start">
              <div className="w-20 text-gray-600 font-medium">Time:</div>
              <div className="font-medium flex-1">
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
            
            {/* Type and Status */}
            <div className="flex items-start">
              <div className="w-20 text-gray-600 font-medium">Type:</div>
              <div className="flex-1">
                <span className="capitalize font-medium">{activeEvent.type}</span>
                <span className="ml-2 px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700 capitalize">
                  {activeEvent.status}
                </span>
              </div>
            </div>
            
            {/* Dock Information */}
            {activeEvent.dockId && (
              <div className="flex items-start">
                <div className="w-20 text-gray-600 font-medium">Dock:</div>
                <div className="font-medium">Dock #{activeEvent.dockId}</div>
              </div>
            )}
            
            {/* Carrier Information */}
            {activeEvent.carrierName && (
              <div className="flex items-start">
                <div className="w-20 text-gray-600 font-medium">Carrier:</div>
                <div className="font-medium">{activeEvent.carrierName}</div>
              </div>
            )}
            
            {/* Truck/Driver Information */}
            {(activeEvent.truckNumber || activeEvent.driverName) && (
              <div className="flex items-start">
                <div className="w-20 text-gray-600 font-medium">Vehicle:</div>
                <div className="font-medium">
                  {activeEvent.truckNumber && <div>Truck: {activeEvent.truckNumber}</div>}
                  {activeEvent.driverName && <div>Driver: {activeEvent.driverName}</div>}
                </div>
              </div>
            )}
            
            {/* Attention Status */}
            {activeEvent.needsAttention && (
              <div className="flex items-start">
                <div className="w-20 text-gray-600 font-medium">Alert:</div>
                <div className="font-medium text-red-600">
                  {activeEvent.attentionReason}
                </div>
              </div>
            )}
          </div>
          
          <div className="mt-3 text-xs text-center text-gray-500 border-t pt-2">
            Click for more details
          </div>
        </div>
      )}

      {/* ENHANCED: Calendar with maximized screen real estate */}
      <Card className="w-full relative border-0 shadow-sm bg-white/95 backdrop-blur-sm">
        {/* Compact timezone information header */}
        <div className="px-3 py-2 border-b bg-slate-50/80 flex items-center justify-between text-xs">
          <div className="text-xs text-gray-600">
            <Clock className="w-3 h-3 inline mr-1 text-blue-600" />
            <span className="font-medium">Calendar Timezone:</span> {getTimeZoneAbbreviation(effectiveTimezone)} ({effectiveTimezone.split('/').pop()?.replace('_', ' ')})
          </div>
          <div className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-sm font-medium flex items-center">
            <Clock className="w-2.5 h-2.5 mr-1" />
            Times in {getTimeZoneAbbreviation(effectiveTimezone)}
          </div>
        </div>
        
        <CardContent className="p-0">
          {/* ENHANCED: Calendar container with maximum screen real estate */}
          <div className="calendar-container h-[calc(100vh-8rem)]">
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
              dayMaxEvents={false} // Show all events for better visibility
              weekends={true}
              eventClick={handleEventClick}
              select={handleDateSelect}
              eventMouseEnter={handleEventMouseEnter}
              eventMouseLeave={handleEventMouseLeave}
              allDaySlot={false}
              slotDuration="00:30:00"
              slotLabelInterval="01:00"
              slotMinTime="05:00:00"
              slotMaxTime="22:00:00"
              
              // ENHANCED: Maximized screen usage with optimal aspect ratios
              height="100%"
              aspectRatio={currentView === 'timeGridDay' ? 2.2 : currentView === 'timeGridWeek' ? 1.6 : 1.35}
              handleWindowResize={true}
              
              // ENHANCED: View-specific configurations for optimal display
              views={{
                timeGridDay: {
                  titleFormat: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' },
                  slotLabelFormat: { hour: 'numeric', minute: '2-digit', hour12: true },
                  eventTimeFormat: { hour: 'numeric', minute: '2-digit', hour12: true },
                  slotDuration: '00:30:00',
                  slotLabelInterval: '01:00',
                  snapDuration: '00:15:00',
                  dayMaxEvents: false, // Show all events in day view
                  dayMaxEventRows: false,
                  eventMaxStack: 0, // Allow unlimited stacking
                  moreLinkClick: 'day'
                },
                timeGridWeek: {
                  slotDuration: '00:30:00',
                  slotLabelInterval: '01:00',
                  dayMaxEvents: false, // Show more events
                  eventMaxStack: 0,
                  moreLinkClick: 'day'
                },
                dayGridMonth: {
                  dayMaxEvents: 4,
                  moreLinkClick: 'day',
                  fixedWeekCount: false
                }
              }}
              
              // ENHANCED: Improved title format
              titleFormat={{
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              }}
              
              // ENHANCED: Optimized settings for better display
              fixedWeekCount={false}
              navLinks={false}
              moreLinkClick="popover"
              
              // ENHANCED: Event display with better visibility
              eventDisplay="block"
              eventTimeFormat={{
                hour: '2-digit',
                minute: '2-digit',
                meridiem: 'short',
                hour12: true,
                timeZone: effectiveTimezone
              }}
              
              // ENHANCED: Better event management
              eventOrder="start,-duration,allDay,title"
              eventOverlap={true}
              
              // Force event duration for consistency
              forceEventDuration={true}
              defaultTimedEventDuration="00:30:00"
              
              // Improved loading state management
              loading={(isLoading) => {
                if (import.meta.env.MODE === 'development') {
                  console.log('[FullCalendar] Loading state changed:', isLoading);
                }
                setIsLoading(isLoading);
              }}
              
              // Enhanced view handling
              viewDidMount={(viewInfo) => {
                if (import.meta.env.MODE === 'development') {
                  console.log('[FullCalendar] View mounted:', viewInfo.view.type);
                }
                handleViewChange(viewInfo);
                setCalendarReady(true);
              }}
              
              // ENHANCED: Custom event rendering for better Customer/Facility display
              eventContent={(eventInfo) => {
                const { event } = eventInfo;
                const props = event.extendedProps;
                
                return (
                  <div className="fc-event-content-enhanced p-1 overflow-hidden">
                    {/* Customer Name prominently displayed */}
                    <div className="font-semibold text-sm leading-tight mb-1 truncate">
                      {props.customerName || 'Appointment'}
                    </div>
                    
                    {/* Facility Name */}
                    {props.facilityName && (
                      <div className="text-xs opacity-90 leading-tight mb-1 truncate">
                        📍 {props.facilityName}
                      </div>
                    )}
                    
                    {/* Dock info only (time removed since it's redundant with calendar grid) */}
                    {props.dockId && (
                      <div className="text-xs opacity-85 leading-tight truncate">
                        Dock #{props.dockId}
                      </div>
                    )}
                    
                    {/* Status indicator */}
                    {props.needsAttention && (
                      <div className="text-xs font-bold mt-1 truncate">
                        ⚠️ {props.attentionReason}
                      </div>
                    )}
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