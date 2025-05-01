import React, { useState, useEffect, useRef, MutableRefObject } from 'react';
import { Clock } from 'lucide-react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import './calendar-clean.css'; // One clean CSS file with all needed fixes
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
  // Get user's timezone and set as default, or use the passed timezone prop
  const [selectedTimezone, setSelectedTimezone] = useState<string>(timezone || getUserTimeZone());
  
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
  
  // Update selectedTimezone when the timezone prop changes
  useEffect(() => {
    if (timezone) {
      setSelectedTimezone(timezone);
    }
  }, [timezone]);
  
  // Use the external ref if provided, otherwise create a local one
  const calendarRef = externalCalendarRef || useRef<FullCalendar>(null);
  
  // Initialize timezone based on browser's timezone or saved preference
  useEffect(() => {
    // Get browser's timezone
    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // Load saved timezone preference if it exists, otherwise use browser timezone
    const savedTimezone = localStorage.getItem('preferredTimezone');
    if (savedTimezone) {
      setSelectedTimezone(savedTimezone);
    } else if (browserTimezone) {
      setSelectedTimezone(browserTimezone);
      localStorage.setItem('preferredTimezone', browserTimezone);
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

  // Now map the sorted schedules to events
  const events: EventInput[] = sortedSchedules.map(schedule => {
    const isInbound = schedule.type === 'inbound';
    
    // Check if this appointment needs attention
    const attention = needsAttention(schedule);
    
    // Determine color based on status and attention needed
    let statusColor = '';
    
    if (attention.needsAttention) {
      statusColor = attention.isUrgent ? '#DC2626' : '#F97316'; // Red for urgent, orange for warning
    } else {
      statusColor = schedule.status === 'completed' ? '#4ADE80' : 
                  schedule.status === 'checked-in' ? '#F59E0B' :
                  schedule.status === 'canceled' ? '#EF4444' : 
                  schedule.status === 'no-show' ? '#6B7280' : 
                  (isInbound ? '#3B82F6' : '#10B981');
    }
    
    // Date utilities
    const startTime = new Date(schedule.startTime);
    const hour = startTime.getHours();
    const mins = startTime.getMinutes();
    
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
    
    // Include facility name in title for better visibility
    if (extractedFacilityName) {
      title += `${extractedFacilityName}\n`;
    }
    
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
    } else if (attention.needsAttention) {
      title += `\n${attention.reason.toUpperCase()}`;
    }
    
    // Calculate dynamic z-index based on hour - later hours should be higher
    // This is critical for proper event stacking
    const zIndex = 100 + (hour * 100); // 100-2300 range based on 24 hour time
    
    // Determine additional classes based on attention needed
    const attentionClass = attention.needsAttention 
      ? attention.isUrgent ? 'urgent-attention' : 'needs-attention'
      : '';
    
    return {
      id: schedule.id.toString(),
      title: title,
      start: schedule.startTime,
      end: schedule.endTime,
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
    
    // Use Intl.DateTimeFormat for formatting dates with timezone awareness
    const options: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone || undefined
    };
    
    try {
      return new Intl.DateTimeFormat('en-US', options).format(date);
    } catch (error) {
      // Fallback to browser's timezone if the specified timezone is invalid
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
                {activeEvent.facilityTimezone && (
                  <span className="block text-xs bg-blue-50 text-blue-700 rounded-sm px-2 py-1 mt-1 font-medium flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    Facility timezone: {activeEvent.facilityTimezone}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="ml-1 cursor-help">(i)</span>
                        </TooltipTrigger>
                        <TooltipContent className="w-60 p-2">
                          <p className="text-xs">This appointment was booked in the facility's timezone and will remain at this time regardless of your display timezone.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="w-24 text-muted-foreground">Facility:</div>
              <div className="font-medium">{activeEvent.facilityName || 'Not specified'}</div>
            </div>
            
            {/* Timezone information now incorporated into time section above */}
            
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
              <div className="w-24 text-muted-foreground">Type:</div>
              <div className="font-medium capitalize">{activeEvent.type || 'Not specified'}</div>
            </div>
            
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
        <div className="p-2 border-b bg-slate-50 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            <Clock className="w-4 h-4 inline mr-1 text-primary" />
            <span className="font-medium">Your Display Timezone:</span> {selectedTimezone}
          </div>
          <div className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-md font-medium flex items-center">
            <Clock className="w-3 h-3 mr-1" />
            Times are shifted from facility timezone to your selected timezone
          </div>
        </div>
        <CardContent className="p-0">
          <div className="calendar-container h-[calc(100vh-16rem)]">
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
                const customerName = eventData?.customerName || '';
                const carrierName = eventData?.carrierName || '';
                const dockId = eventData?.dockId || '';
                const status = eventData?.status || '';
                const needsAttention = eventData?.needsAttention || false;
                const attentionReason = eventData?.attentionReason || '';
                const truckNumber = eventData?.truckNumber || '';
                
                console.log('Event data:', {
                  id: eventInfo.event.id,
                  facilityName,
                  facilityId: eventData?.facilityId,
                  customerName,
                  carrierName
                });
                
                // Determine if we need to show a status badge
                const showStatusBadge = status && status !== 'scheduled';
                const showAttentionBadge = !showStatusBadge && needsAttention;
                
                return (
                  <div className="w-full h-full p-1.5 flex flex-col justify-start overflow-hidden">
                    {/* Time with more prominence */}
                    <div className="text-xs font-semibold mb-0.5">{eventInfo.timeText}</div>
                    
                    {/* Facility/Location Name with highest priority */}
                    {facilityName && (
                      <div className="font-bold text-[11px] text-blue-700 bg-blue-50 py-0.5 px-1 rounded-sm mb-0.5 border border-blue-200">
                        {facilityName}
                      </div>
                    )}
                    
                    {/* Customer Name - Prominent */}
                    <div className="text-xs font-medium line-clamp-1 overflow-hidden text-ellipsis">
                      {customerName && <span className="font-semibold block">{customerName}</span>}
                    </div>
                    
                    {/* Carrier Name - Prominent */}
                    <div className="text-[10px] font-medium line-clamp-1 overflow-hidden text-ellipsis">
                      {carrierName && <span className="block">{carrierName}</span>}
                    </div>
                    
                    {/* Additional details with lower priority */}
                    <div className="text-[9px] text-gray-700 line-clamp-1 overflow-hidden">
                      {truckNumber && <span className="inline-block mr-1">#{truckNumber}</span>}
                      {dockId && <span className="inline-block">Dock #{dockId}</span>}
                    </div>
                    
                    {/* Status badge */}
                    {showStatusBadge && (
                      <div className="mt-1 text-[9px] font-bold bg-white/20 text-white rounded px-1 py-0.5 max-w-fit">
                        {status.toUpperCase()}
                      </div>
                    )}
                    
                    {/* Attention badge */}
                    {showAttentionBadge && (
                      <div className="mt-1 text-[9px] font-bold bg-white/20 text-white rounded px-1 py-0.5 max-w-fit animate-pulse">
                        {attentionReason.toUpperCase()}
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