import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { Clock, Calendar, MapPin, User, Settings, Eye, EyeOff } from 'lucide-react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { DateSelectArg, EventClickArg, EventInput, EventChangeArg } from '@fullcalendar/core';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Schedule } from '@shared/schema';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { getUserTimeZone, getTimeZoneAbbreviation } from '@/lib/timezone-utils';
import './calendar-enhanced.css';

interface CalendarDisplaySettings {
  showCustomerName: boolean;
  showDriverName: boolean;
  showCarrierName: boolean;
  showTruckNumber: boolean;
  showTrailerNumber: boolean;
  showAppointmentType: boolean;
  showDockInfo: boolean;
  showTimeDisplay: boolean;
  showStatusBadge: boolean;
  showPriorityIndicator: boolean;
  compactMode: boolean;
  showBOLInfo: boolean;
  showNotesPreview: boolean;
}

interface EnhancedCalendarViewProps {
  schedules: Schedule[];
  onEventClick: (scheduleId: number) => void;
  onDateSelect?: (selectInfo: { start: Date; end: Date; allDay: boolean }) => void;
  timezone?: string;
  calendarRef?: React.RefObject<FullCalendar>;
  initialView?: string;
  facilityId?: number;
  enableDragDrop?: boolean;
}

interface UnscheduledAppointment {
  id: number;
  title: string;
  duration: number; // in minutes
  appointmentType: string;
  customer: string;
  priority: 'high' | 'medium' | 'low';
  requestedDate?: Date;
  metadata: any;
}

// Calendar Settings Component
function CalendarSettings({ 
  settings, 
  onSettingsChange 
}: { 
  settings: CalendarDisplaySettings;
  onSettingsChange: (settings: CalendarDisplaySettings) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = (key: keyof CalendarDisplaySettings) => {
    onSettingsChange({
      ...settings,
      [key]: !settings[key]
    });
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 px-2">
          <Settings className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Calendar Display Settings</h4>
            <p className="text-sm text-muted-foreground">
              Choose what information to display in calendar events
            </p>
          </div>
          
          <Separator />
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="customerName" className="text-sm">Customer Name</Label>
              <Switch
                id="customerName"
                checked={settings.showCustomerName}
                onCheckedChange={() => handleToggle('showCustomerName')}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="driverName" className="text-sm">Driver Name</Label>
              <Switch
                id="driverName"
                checked={settings.showDriverName}
                onCheckedChange={() => handleToggle('showDriverName')}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="carrierName" className="text-sm">Carrier Name</Label>
              <Switch
                id="carrierName"
                checked={settings.showCarrierName}
                onCheckedChange={() => handleToggle('showCarrierName')}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="truckNumber" className="text-sm">Truck Number</Label>
              <Switch
                id="truckNumber"
                checked={settings.showTruckNumber}
                onCheckedChange={() => handleToggle('showTruckNumber')}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="trailerNumber" className="text-sm">Trailer Number</Label>
              <Switch
                id="trailerNumber"
                checked={settings.showTrailerNumber}
                onCheckedChange={() => handleToggle('showTrailerNumber')}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="appointmentType" className="text-sm">Appointment Type</Label>
              <Switch
                id="appointmentType"
                checked={settings.showAppointmentType}
                onCheckedChange={() => handleToggle('showAppointmentType')}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="dockInfo" className="text-sm">Dock Information</Label>
              <Switch
                id="dockInfo"
                checked={settings.showDockInfo}
                onCheckedChange={() => handleToggle('showDockInfo')}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="timeDisplay" className="text-sm">Time Display</Label>
              <Switch
                id="timeDisplay"
                checked={settings.showTimeDisplay}
                onCheckedChange={() => handleToggle('showTimeDisplay')}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="statusBadge" className="text-sm">Status Badge</Label>
              <Switch
                id="statusBadge"
                checked={settings.showStatusBadge}
                onCheckedChange={() => handleToggle('showStatusBadge')}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="bolInfo" className="text-sm">BOL Information</Label>
              <Switch
                id="bolInfo"
                checked={settings.showBOLInfo}
                onCheckedChange={() => handleToggle('showBOLInfo')}
              />
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <Label htmlFor="compactMode" className="text-sm">Compact Mode</Label>
              <Switch
                id="compactMode"
                checked={settings.compactMode}
                onCheckedChange={() => handleToggle('compactMode')}
              />
            </div>
          </div>
          
          <Separator />
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onSettingsChange({
                showCustomerName: true,
                showDriverName: true,
                showCarrierName: true,
                showTruckNumber: true,
                showTrailerNumber: false,
                showAppointmentType: true,
                showDockInfo: true,
                showTimeDisplay: false, // Disabled by default since calendar grid shows time
                showStatusBadge: true,
                showPriorityIndicator: true,
                compactMode: false,
                showBOLInfo: false,
                showNotesPreview: false
              })}
              className="flex-1"
            >
              Reset Default
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsOpen(false)}
              className="flex-1"
            >
              Close
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function EnhancedCalendarView({
  schedules,
  onEventClick,
  onDateSelect,
  timezone,
  calendarRef: externalCalendarRef,
  initialView = 'timeGridWeek',
  facilityId,
  enableDragDrop = true,
}: EnhancedCalendarViewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const calendarRef = externalCalendarRef || useRef<FullCalendar>(null);
  
  const [effectiveTimezone, setEffectiveTimezone] = useState<string>(getUserTimeZone());
  const [unscheduledAppointments, setUnscheduledAppointments] = useState<UnscheduledAppointment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  
  // Calendar display settings with localStorage persistence
  const [displaySettings, setDisplaySettings] = useState<CalendarDisplaySettings>(() => {
    const saved = localStorage.getItem('calendar-display-settings');
    return saved ? JSON.parse(saved) : {
      showCustomerName: true,
      showDriverName: true,
      showCarrierName: true,
      showTruckNumber: true,
      showTrailerNumber: false,
      showAppointmentType: true,
      showDockInfo: true,
      showTimeDisplay: false, // Disabled by default since calendar grid shows time
      showStatusBadge: true,
      showPriorityIndicator: true,
      compactMode: false,
      showBOLInfo: false,
      showNotesPreview: false
    };
  });

  // Save settings to localStorage when changed
  useEffect(() => {
    localStorage.setItem('calendar-display-settings', JSON.stringify(displaySettings));
  }, [displaySettings]);

  // Generate event title based on display settings
  const generateEventTitle = useCallback((schedule: Schedule) => {
    const parts: string[] = [];
    
    if (displaySettings.showTruckNumber && schedule.truckNumber) {
      parts.push(`🚛 ${schedule.truckNumber}`);
    }
    
    if (displaySettings.showCustomerName && schedule.customerName) {
      parts.push(`👤 ${schedule.customerName}`);
    }
    
    if (displaySettings.showDriverName && schedule.driverName) {
      parts.push(`👨‍💼 ${schedule.driverName}`);
    }
    
    if (displaySettings.showCarrierName && schedule.carrierName) {
      parts.push(`🏢 ${schedule.carrierName}`);
    }
    
    if (displaySettings.showAppointmentType && schedule.appointmentTypeId) {
      parts.push(`📋 ${schedule.type || 'Standard'}`);
    }
    
    if (displaySettings.showBOLInfo && schedule.bolNumber) {
      parts.push(`📄 BOL: ${schedule.bolNumber}`);
    }
    
    return parts.length > 0 ? parts.join(' • ') : 'Appointment';
  }, [displaySettings]);

  // Fetch facility data for timezone
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

  // Fetch unscheduled appointments
  const { data: unscheduledData = [] } = useQuery<UnscheduledAppointment[]>({
    queryKey: ['/api/schedules/unscheduled'],
    queryFn: async () => {
      const response = await fetch('/api/schedules/unscheduled');
      if (!response.ok) throw new Error('Failed to fetch unscheduled appointments');
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Update timezone when facility data changes
  useEffect(() => {
    let targetTimezone = getUserTimeZone();
    
    if (timezone) {
      targetTimezone = timezone;
    } else if (facility?.timezone) {
      targetTimezone = facility.timezone;
    }
    
    setEffectiveTimezone(targetTimezone);
  }, [timezone, facility]);

  // Update unscheduled appointments
  useEffect(() => {
    setUnscheduledAppointments(unscheduledData);
  }, [unscheduledData]);

  // Convert schedules to FullCalendar events with enhanced styling
  const events: EventInput[] = useMemo(() => {
    return schedules.map(schedule => {
      const startTime = new Date(schedule.startTime);
      const endTime = new Date(schedule.endTime);
      
      // Enhanced event styling based on status and priority
      let backgroundColor = '#3b82f6'; // default blue
      let borderColor = '#1e40af';
      let textColor = '#ffffff';
      
      switch (schedule.status) {
        case 'confirmed':
          backgroundColor = '#22c55e';
          borderColor = '#16a34a';
          break;
        case 'checked-in':
          backgroundColor = '#f59e0b';
          borderColor = '#d97706';
          break;
        case 'in-progress':
          backgroundColor = '#8b5cf6';
          borderColor = '#7c3aed';
          break;
        case 'completed':
          backgroundColor = '#6b7280';
          borderColor = '#4b5563';
          break;
        case 'cancelled':
          backgroundColor = '#ef4444';
          borderColor = '#dc2626';
          break;
        case 'no-show':
          backgroundColor = '#dc2626';
          borderColor = '#991b1b';
          textColor = '#ffffff';
          break;
      }

      return {
        id: schedule.id.toString(),
        title: generateEventTitle(schedule),
        start: startTime,
        end: endTime,
        backgroundColor,
        borderColor,
        textColor,
        extendedProps: {
          schedule,
          confirmationCode: (schedule.customFormData as any)?.confirmationCode || '',
          driverName: schedule.driverName,
          carrierName: schedule.carrierName,
          status: schedule.status,
          facilityId: schedule.facilityId,
        },
        editable: enableDragDrop && ['scheduled', 'confirmed'].includes(schedule.status),
        startEditable: enableDragDrop,
        durationEditable: enableDragDrop,
      };
    });
  }, [schedules, enableDragDrop, generateEventTitle]);

  // Mutation to update appointment time
  const updateAppointmentMutation = useMutation({
    mutationFn: async ({ scheduleId, start, end }: { scheduleId: number; start: Date; end: Date }) => {
      const response = await apiRequest('PUT', `/api/schedules/${scheduleId}`, {
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      });
      if (!response.ok) {
        throw new Error('Failed to update appointment time');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/schedules'] });
      toast({
        title: "Appointment Updated",
        description: "The appointment time has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
      // Refresh calendar to revert changes
      queryClient.invalidateQueries({ queryKey: ['/api/schedules'] });
    },
  });

  // Mutation to schedule unscheduled appointment
  const scheduleAppointmentMutation = useMutation({
    mutationFn: async ({ appointmentId, start, end }: { appointmentId: number; start: Date; end: Date }) => {
      const response = await apiRequest('POST', `/api/schedules/${appointmentId}/schedule`, {
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        facilityId,
      });
      if (!response.ok) {
        throw new Error('Failed to schedule appointment');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/schedules'] });
      queryClient.invalidateQueries({ queryKey: ['/api/schedules/unscheduled'] });
      toast({
        title: "Appointment Scheduled",
        description: "The appointment has been scheduled successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Scheduling Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle FullCalendar event changes (drag/drop/resize)
  const handleEventChange = useCallback((changeInfo: EventChangeArg) => {
    const { event } = changeInfo;
    const scheduleId = parseInt(event.id);
    const start = event.start!;
    const end = event.end!;

    updateAppointmentMutation.mutate({ scheduleId, start, end });
  }, [updateAppointmentMutation]);

  // Handle event click
  const handleEventClick = useCallback((clickInfo: EventClickArg) => {
    const scheduleId = parseInt(clickInfo.event.id);
    onEventClick(scheduleId);
  }, [onEventClick]);

  // Handle date selection
  const handleDateSelect = useCallback((selectInfo: DateSelectArg) => {
    if (onDateSelect) {
      onDateSelect({
        start: selectInfo.start,
        end: selectInfo.end,
        allDay: selectInfo.allDay,
      });
    }
  }, [onDateSelect]);

  // Handle drag and drop from unscheduled list
  const handleDragEnd = useCallback((result: DropResult) => {
    const { destination, source, draggableId } = result;
    
    setIsDragging(false);

    if (!destination) {
      return;
    }

    // If dropped on calendar area
    if (destination.droppableId === 'calendar') {
      const appointmentId = parseInt(draggableId);
      const appointment = unscheduledAppointments.find(apt => apt.id === appointmentId);
      
      if (appointment) {
        // Get the calendar API to determine the drop time
        const calendarApi = calendarRef.current?.getApi();
        if (calendarApi) {
          // For now, schedule at the next available slot (simplified)
          const now = new Date();
          const start = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
          const end = new Date(start.getTime() + appointment.duration * 60 * 1000);
          
          scheduleAppointmentMutation.mutate({ appointmentId, start, end });
        }
      }
    }
  }, [unscheduledAppointments, scheduleAppointmentMutation, calendarRef]);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  // Priority colors for unscheduled appointments
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 border-red-300 text-red-800';
      case 'medium':
        return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'low':
        return 'bg-green-100 border-green-300 text-green-800';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  return (
    <div className="h-full flex gap-4">
      {/* Unscheduled Appointments Sidebar */}
      {enableDragDrop && (
        <DragDropContext onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
          <div className="w-80 bg-white border rounded-lg p-4 overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold">Unscheduled Appointments</h3>
              <Badge variant="secondary">{unscheduledAppointments.length}</Badge>
            </div>
            
            <Droppable droppableId="unscheduled">
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`flex-1 overflow-y-auto space-y-2 ${
                    snapshot.isDraggingOver ? 'bg-blue-50' : ''
                  }`}
                >
                  {unscheduledAppointments.map((appointment, index) => (
                    <Draggable
                      key={appointment.id}
                      draggableId={appointment.id.toString()}
                      index={index}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={`p-3 border rounded-lg cursor-move transition-all ${
                            getPriorityColor(appointment.priority)
                          } ${
                            snapshot.isDragging
                              ? 'shadow-lg transform rotate-2 scale-105'
                              : 'hover:shadow-md'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{appointment.title}</div>
                              <div className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                                <User className="h-3 w-3" />
                                <span className="truncate">{appointment.customer}</span>
                              </div>
                              <div className="text-sm text-gray-600 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <span>{appointment.duration} min</span>
                              </div>
                              {appointment.requestedDate && (
                                <div className="text-xs text-gray-500 mt-1">
                                  Requested: {appointment.requestedDate.toLocaleDateString()}
                                </div>
                              )}
                            </div>
                            <Badge className={`ml-2 ${getPriorityColor(appointment.priority)}`}>
                              {appointment.priority}
                            </Badge>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                  
                  {unscheduledAppointments.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                      <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No unscheduled appointments</p>
                    </div>
                  )}
                </div>
              )}
            </Droppable>
          </div>

          {/* Calendar Area */}
          <Droppable droppableId="calendar">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`flex-1 ${
                  snapshot.isDraggingOver ? 'ring-2 ring-blue-300 ring-opacity-50' : ''
                }`}
              >
                <Card className="h-full">
                  <CardContent className="p-0 h-full">
                    {/* Calendar Settings Button */}
                    <div className="absolute top-2 right-2 z-10 bg-white rounded-lg shadow-sm border">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <CalendarSettings 
                              settings={displaySettings} 
                              onSettingsChange={setDisplaySettings}
                            />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Configure calendar display options</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    
                    <div className={`h-full calendar-container ${isDragging ? 'dragging' : ''} ${displaySettings.compactMode ? 'compact-mode' : ''}`}>
                      <FullCalendar
                        ref={calendarRef}
                        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                        initialView={initialView}
                        headerToolbar={{
                          left: 'prev,next today',
                          center: 'title',
                          right: 'dayGridMonth,timeGridWeek,timeGridDay'
                        }}
                        nowIndicator={true}
                        timeZone={effectiveTimezone}
                        events={events}
                        selectable={!!onDateSelect}
                        selectMirror={true}
                        editable={enableDragDrop}
                        eventResizableFromStart={enableDragDrop}
                        eventDurationEditable={enableDragDrop}
                        eventStartEditable={enableDragDrop}
                        eventClick={handleEventClick}
                        select={handleDateSelect}
                        eventChange={handleEventChange}
                        height="100%"
                        aspectRatio={1.6}
                        slotDuration="00:30:00"
                        slotLabelInterval="01:00"
                        slotMinTime="05:00:00"
                        slotMaxTime="22:00:00"
                        businessHours={{
                          daysOfWeek: [1, 2, 3, 4, 5], // Monday to Friday
                          startTime: '08:00',
                          endTime: '18:00',
                        }}
                        eventDisplay="block"
                        dayMaxEvents={false}
                        eventOrderStrict={true}
                        eventConstraint="businessHours"
                        eventClassNames={(arg) => {
                          const classes = ['custom-event'];
                          if (displaySettings.compactMode) {
                            classes.push('compact-event');
                          }
                          return classes;
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {/* Standard Calendar (when drag-drop is disabled) */}
      {!enableDragDrop && (
        <Card className="w-full">
          <CardContent className="p-0">
            {/* Calendar Settings Button */}
            <div className="absolute top-2 right-2 z-10 bg-white rounded-lg shadow-sm border">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <CalendarSettings 
                      settings={displaySettings} 
                      onSettingsChange={setDisplaySettings}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Configure calendar display options</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            
            <div className={`h-[calc(100vh-8rem)] calendar-container ${displaySettings.compactMode ? 'compact-mode' : ''}`}>
              <FullCalendar
                ref={calendarRef}
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView={initialView}
                headerToolbar={{
                  left: 'prev,next today',
                  center: 'title',
                  right: 'dayGridMonth,timeGridWeek,timeGridDay'
                }}
                nowIndicator={true}
                timeZone={effectiveTimezone}
                events={events}
                selectable={!!onDateSelect}
                selectMirror={true}
                eventClick={handleEventClick}
                select={handleDateSelect}
                height="100%"
                aspectRatio={1.6}
                slotDuration="00:30:00"
                slotLabelInterval="01:00"
                slotMinTime="05:00:00"
                slotMaxTime="22:00:00"
                eventClassNames={(arg) => {
                  const classes = ['custom-event'];
                  if (displaySettings.compactMode) {
                    classes.push('compact-event');
                  }
                  return classes;
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 