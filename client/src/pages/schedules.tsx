import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { Schedule as BaseSchedule, Dock, Carrier, Facility, AppointmentType } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, Calendar as CalendarIcon, ListFilter, Grid, List, Eye, Search, XCircle, Clock, CheckCircle2, Globe, Check } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { DataTable } from "@/components/ui/data-table";
import ScheduleCalendar from "@/components/schedules/schedule-calendar";
import ScheduleWeekCalendar from "@/components/schedules/schedule-week-calendar";
import ScheduleDayCalendar from "@/components/schedules/schedule-day-calendar";
import ScheduleMonthCalendar from "@/components/schedules/schedule-month-calendar";
import AppointmentForm from "@/components/schedules/appointment-form";
import UnifiedAppointmentFlow from "@/components/appointment/unified-appointment-flow";
import { AppointmentDetailsDialog } from "@/components/schedules/appointment-details-dialog";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatTime } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { getUserTimeZone, getTimeZoneAbbreviation } from "@shared/timezone-service";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// Extended Schedule interface with additional derived properties
interface Schedule extends BaseSchedule {
  dockName?: string;
  appointmentTypeName?: string;
  facilityName?: string;
}

export default function Schedules() {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editScheduleId, setEditScheduleId] = useState<number | null>(null);
  const [clickedCellDate, setClickedCellDate] = useState<Date | undefined>(undefined);
  const [viewMode, setViewMode] = useState<"calendar" | "week" | "day" | "month" | "list">("week");
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string[]>(["all"]);
  const [filterType, setFilterType] = useState<string[]>(["all"]);
  const [filterFacilityId, setFilterFacilityId] = useState<(number | "all")[]>(["all"]);
  const [filterDockId, setFilterDockId] = useState<(number | "all")[]>(["all"]);
  const [selectedDockId, setSelectedDockId] = useState<number | undefined>(undefined);
  const [isAppointmentTypeDialogOpen, setIsAppointmentTypeDialogOpen] = useState(false);
  const [selectedAppointmentTypeId, setSelectedAppointmentTypeId] = useState<number | undefined>(undefined);
  const [timezone, setTimezone] = useState<string>(() => {
    try {
      return getUserTimeZone();
    } catch (error) {
      console.error('Error getting user timezone:', error);
      return 'America/New_York'; // Fallback timezone
    }
  });
  const [timeFormat, setTimeFormat] = useState<"12h" | "24h">("12h");
  
  // Fetch all data first
  const { data: rawSchedules = [] } = useQuery<BaseSchedule[]>({
    queryKey: ["/api/schedules"]
  });
  
  // Fetch docks
  const { data: docks = [] } = useQuery<Dock[]>({
    queryKey: ["/api/docks"],
  });
  
  // Fetch carriers
  const { data: carriers = [] } = useQuery<Carrier[]>({
    queryKey: ["/api/carriers"],
  });
  
  // Fetch facilities
  const { data: facilities = [] } = useQuery<Facility[]>({
    queryKey: ["/api/facilities"],
  });
  
  // Fetch appointment types
  const { data: appointmentTypes = [], isError: appointmentTypesError } = useQuery<AppointmentType[]>({
    queryKey: ["/api/appointment-types"]
  });
  
  // Transform raw schedules to extend them with additional properties
  const schedules: Schedule[] = (rawSchedules || []).map((schedule: any) => {
    try {
      return {
        ...schedule,
        dockName: schedule.dockId && Array.isArray(docks) ? docks.find(d => d.id === schedule.dockId)?.name : undefined,
        appointmentTypeName: schedule.appointmentTypeId && Array.isArray(appointmentTypes) ? appointmentTypes.find(t => t.id === schedule.appointmentTypeId)?.name : undefined,
        facilityName: schedule.facilityId && Array.isArray(facilities) 
          ? facilities.find(f => f.id === schedule.facilityId)?.name 
          : undefined
      };
    } catch (error) {
      console.error('Error transforming schedule:', schedule, error);
      return {
        ...schedule,
        dockName: undefined,
        appointmentTypeName: undefined,
        facilityName: undefined
      };
    }
  });
  
  // Set the most current schedule as selected on first load
  // Check for schedule ID in URL params
  const [, params] = useRoute<{ id: string }>("/schedules/:id");
  const [location, setLocation] = useLocation();
  
  // State for view transitions
  const [isViewTransitioning, setIsViewTransitioning] = useState(false);
  
  // Process URL query parameters
  useEffect(() => {
    // Process query parameters for view mode
    const queryParams = new URLSearchParams(window.location.search);
    const viewParam = queryParams.get('view');
    const editParam = queryParams.get('edit');
    const dateParam = queryParams.get('date');
    
    // Handle view mode parameter
    if (viewParam) {
      // Set transitioning state to show loading indicator
      setIsViewTransitioning(true);
      
      // Slight delay before changing view to allow DOM to update
      setTimeout(() => {
        switch(viewParam) {
          case 'day':
            setViewMode('day');
            break;
          case 'week':
            setViewMode('week');
            break;
          case 'month':
            setViewMode('month');
            break;
          case 'list':
            setViewMode('list');
            break;
        }
        
        // Clear transitioning state after a delay
        setTimeout(() => {
          setIsViewTransitioning(false);
        }, 300);
      }, 50);
    }
    
    // Handle date parameter if present
    if (dateParam) {
      try {
        const parsedDate = new Date(dateParam);
        if (!isNaN(parsedDate.getTime())) {
          setSelectedDate(parsedDate);
        }
      } catch (e) {
        console.error("Invalid date parameter:", dateParam);
      }
    }
    
    // Handle edit parameter - open edit form for specified appointment
    if (editParam && !isNaN(Number(editParam))) {
      const scheduleId = Number(editParam);
      setEditScheduleId(scheduleId);
      setIsFormOpen(true);
    }
  }, [location]);
  
  // Listen for viewchange custom events from calendar components
  useEffect(() => {
    const handleViewChange = (event: CustomEvent) => {
      console.log("View change event detected:", event.detail);
      
      // Extract view and date information from the event
      const { view, date } = event.detail;
      
      // Check if we're just cycling back to the same view
      const isSameView = view === viewMode;
      
      // Use a shorter transition if we're staying in the same view or going from week to day
      const isOptimizedTransition = 
        isSameView || 
        (viewMode === 'week' && view === 'day');
        
      if (!isOptimizedTransition) {
        // Set transitioning state to show loading indicator for major view changes
        setIsViewTransitioning(true);
      }
      
      // Update the view mode state
      if (view === 'day' || view === 'week' || view === 'month' || view === 'list') {
        // Update immediately for optimized transitions
        if (isOptimizedTransition) {
          setViewMode(view);
          
          // Update the selected date if provided
          if (date) {
            setSelectedDate(new Date(date));
          }
          
          // Skip long transition for optimized paths
          setIsViewTransitioning(false);
        } else {
          // Use traditional delayed transition for bigger view changes
          setTimeout(() => {
            setViewMode(view);
            
            // Update the selected date if provided
            if (date) {
              setSelectedDate(new Date(date));
            }
            
            // Clear transitioning state after a short delay
            setTimeout(() => {
              setIsViewTransitioning(false);
            }, 300);
          }, 50);
        }
      }
    };
    
    // Add event listener for our custom viewchange event
    window.addEventListener('viewchange', handleViewChange as EventListener);
    
    // Cleanup function to remove event listener
    return () => {
      window.removeEventListener('viewchange', handleViewChange as EventListener);
    };
  }, [viewMode, setViewMode, setSelectedDate]);
  
  // Handle closing the appointment details dialog
  const handleDetailsDialogClose = useCallback((open: boolean) => {
    setIsDetailsDialogOpen(open);
    // If dialog is being closed and we're on a specific schedule URL, navigate back to main schedules page
    if (!open && params && params.id) {
      setLocation("/schedules");
    }
  }, [params, setLocation]);
  
  useEffect(() => {
    // First check if we have an ID in the URL parameters
    if (params && params.id && schedules.length > 0) {
      const scheduleId = parseInt(params.id);
      const schedule = schedules.find(s => s.id === scheduleId);
      if (schedule) {
        setSelectedSchedule(schedule);
        setIsDetailsDialogOpen(true);
      }
    }
    // Otherwise set the first schedule as selected if none is selected
    else if (schedules.length > 0 && !selectedSchedule) {
      setSelectedSchedule(schedules[0]);
    }
  }, [schedules, selectedSchedule, params]);
  
  // Get facility name for a dock
  const getFacilityNameForDock = (dockId: number | null, schedule?: Schedule): string => {
    // If appointment has facilityId or facilityName directly assigned, use that
    if (schedule) {
      if (schedule.facilityName) {
        return schedule.facilityName;
      }
      if (schedule.facilityId) {
        const facility = facilities.find((f: any) => f.id === schedule.facilityId);
        if (facility) return facility.name;
      }
    }
    
    // Fallback to using dock information
    if (!dockId) return "Unknown Facility"; // Changed from "No dock assigned"
    const dock = docks.find((d: any) => d.id === dockId);
    if (!dock) return "Unknown Facility";
    
    const facility = facilities.find((f: any) => f.id === dock.facilityId);
    return facility?.name || "Unknown Facility";
  };
  
  // Schedule being edited
  const scheduleToEdit = editScheduleId 
    ? schedules.find((s: Schedule) => s.id === editScheduleId) 
    : undefined;
  
  // Handle schedule selection
  const handleScheduleClick = (scheduleId: number) => {
    const schedule = schedules.find((s: Schedule) => s.id === scheduleId);
    if (schedule) {
      // Enhance the schedule with derived properties
      const enhancedSchedule = {
        ...schedule,
        dockName: schedule.dockId ? docks.find((d: any) => d.id === schedule.dockId)?.name : undefined,
        appointmentTypeName: schedule.appointmentTypeId ? appointmentTypes.find((t: any) => t.id === schedule.appointmentTypeId)?.name : undefined
      };
      setSelectedSchedule(enhancedSchedule);
      setIsDetailsDialogOpen(true);
    }
  };
  
  // Handle edit click from details dialog
  const handleEditClick = (scheduleId: number) => {
    setEditScheduleId(scheduleId);
    setIsFormOpen(true);
    setIsDetailsDialogOpen(false);
  };
  
  // Handle cell click from calendar views
  const handleCellClick = (date: Date, dockId?: number) => {
    setEditScheduleId(null);
    // Ensure we're working with a valid Date object
    if (date && !isNaN(date.getTime())) {
      // Create a fresh copy to avoid any reference issues
      const safeDateCopy = new Date(date.getTime());
      setClickedCellDate(safeDateCopy);
      
      // If a dock ID was provided, pre-select it in the form
      if (dockId) {
        setSelectedDockId(dockId);
      }
      
      // Skip appointment type dialog and go directly to the form
      // We'll select appointment type in the first step of the new form
      setIsFormOpen(true);
    } else {
      console.error("Invalid date received from cell click:", date);
      // Fallback to current date at noon if we got an invalid date
      const todayNoon = new Date();
      todayNoon.setHours(12, 0, 0, 0);
      setClickedCellDate(todayNoon);
      setIsFormOpen(true);
    }
  };
  
  // Handle appointment type selection
  const handleAppointmentTypeSelected = (appointmentTypeId: number) => {
    console.log("Selected appointment type ID:", appointmentTypeId);
    setSelectedAppointmentTypeId(appointmentTypeId);
    
    // Close the appointment type dialog and open the appointment form
    setIsAppointmentTypeDialogOpen(false);
    setIsFormOpen(true);
    
    // Set appointment type in the schedule creation form
    // The appointment form will use this ID to fetch the appointment type details
    const appointmentType = appointmentTypes.find((type: any) => type.id === appointmentTypeId);
    
    // Log for debugging
    if (appointmentType) {
      console.log("Selected appointment type:", appointmentType.name, "Duration:", appointmentType.duration, "minutes");
    }
  };
  
  // Columns for the data table
  const columns: ColumnDef<Schedule>[] = [
    {
      accessorKey: "truckNumber",
      header: "Truck #",
    },
    {
      accessorKey: "carrierId",
      header: "Carrier",
      cell: ({
        row
      }: any) => {
        const carrierId = row.getValue("carrierId") as number;
        const carrier = carriers.find((c: any) => c.id === carrierId);
        return carrier?.name || "Unknown";
      },
    },
    {
      accessorKey: "dockId",
      header: "Dock",
      cell: ({
        row
      }: any) => {
        const dockId = row.getValue("dockId") as number;
        const dock = docks.find((d: any) => d.id === dockId);
        return dock?.name || "Unknown";
      },
    },
    {
      accessorKey: "startTime",
      header: "Start Time",
      cell: ({
        row
      }: any) => {
        const startTime = row.getValue("startTime") as string;
        return formatTime(startTime);
      },
    },
    {
      accessorKey: "endTime",
      header: "End Time",
      cell: ({
        row
      }: any) => {
        const endTime = row.getValue("endTime") as string;
        return formatTime(endTime);
      },
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({
        row
      }: any) => {
        const type = row.getValue("type") as string;
        return (
          <Badge variant={type === "inbound" ? "default" : "secondary"}>
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </Badge>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({
        row
      }: any) => {
        const status = row.getValue("status") as string;
        let variant: "default" | "secondary" | "destructive" | "outline" = "default";
        
        switch(status) {
          case "scheduled":
            variant = "outline";
            break;
          case "in-progress":
            variant = "default";
            break;
          case "completed":
            variant = "secondary";
            break;
          case "cancelled":
            variant = "destructive";
            break;
        }
        
        return (
          <Badge variant={variant}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      cell: ({
        row
      }: any) => {
        return (
          <Button
            variant="ghost" 
            onClick={() => handleScheduleClick(row.original.id)}
            className="p-0 h-8 px-2"
          >
            View
          </Button>
        );
      },
    },
  ];
  
  // Filter and search schedules - optimized for faster rendering with error handling
  const filteredSchedules = (schedules || []).filter((schedule: Schedule) => {
    try {
      if (!schedule) return false;
    // We should disable exact date matching for day/week view to show all appointments
    // Let the calendar component handle date filtering for better performance
    let dateMatches = true;
    
    // Only apply date filtering for list view
    if (viewMode === "list") {
      const scheduleDate = new Date(schedule.startTime);
      dateMatches = 
        scheduleDate.getDate() === selectedDate.getDate() &&
        scheduleDate.getMonth() === selectedDate.getMonth() &&
        scheduleDate.getFullYear() === selectedDate.getFullYear();
    }
    // For day, week, and month views, don't filter by date here
    
    // Status filter
    const statusMatches = filterStatus.includes("all") || filterStatus.includes(schedule.status);
    
    // Type filter
    const typeMatches = filterType.includes("all") || filterType.includes(schedule.type);

    // Facility filter - this requires looking up the dock's facility
    let facilityMatches = true;
    if (!filterFacilityId.includes("all")) {
      // We need to check both direct facilityId (if present) and also via dock's facility
      let directFacilityMatch = false;
      
      if (schedule.facilityId) {
        directFacilityMatch = filterFacilityId.includes(schedule.facilityId);
      }
      
      let dockFacilityMatch = false;
      if (schedule.dockId) {
        // Get dock and check if its facility is in selected facilities
        const dock = docks.find((d: any) => d.id === schedule.dockId);
        if (dock && dock.facilityId) {
          dockFacilityMatch = filterFacilityId.includes(dock.facilityId);
        }
      }
      
      facilityMatches = directFacilityMatch || dockFacilityMatch;
    }
    
    // Dock filter
    const dockMatches = filterDockId.includes("all") || (schedule.dockId && filterDockId.includes(schedule.dockId));
    
    // Search query - check multiple fields
    let searchMatches = true;
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      const carrier = carriers.find((c: any) => c.id === schedule.carrierId);
      
      searchMatches = 
        (schedule.truckNumber?.toLowerCase().includes(query) || false) ||
        (schedule.driverName?.toLowerCase().includes(query) || false) ||
        (schedule.driverPhone?.includes(query) || false) ||
        (schedule.customerName?.toLowerCase().includes(query) || false) ||
        (schedule.poNumber?.toLowerCase().includes(query) || false) ||
        (schedule.bolNumber?.toLowerCase().includes(query) || false) ||
        (carrier?.name.toLowerCase().includes(query) || false);
    }
    
      return dateMatches && statusMatches && typeMatches && facilityMatches && dockMatches && searchMatches;
    } catch (error) {
      console.error('Error filtering schedule:', schedule, error);
      return false; // Exclude problematic schedules from the list
    }
  });

  return (
    <div className="max-w-full overflow-x-hidden">
      {/* Loading overlay for view transitions */}
      {isViewTransitioning && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <span className="animate-spin">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
              </svg>
            </span>
            <span className="text-sm">Loading view...</span>
          </div>
        </div>
      )}
      
      {/* Consolidated Header Row */}
      <div className="flex flex-wrap items-center mb-6 gap-3">
        {/* Left side: Title and Search */}
        <h2 className="text-xl font-medium whitespace-nowrap mr-2">Calendar</h2>
        
        {/* Only show search in day and month views, not in week view */}
        {viewMode !== "week" && (
          <div className="relative flex-grow max-w-xs min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search appointments..."
              className="pl-8 h-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchQuery.trim()) {
                  // Find and navigate to the closest matching appointment
                  const matchedAppointment = schedules.find(s => 
                    s.truckNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    s.carrierName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    s.customerName?.toLowerCase().includes(searchQuery.toLowerCase())
                  );
                  
                  if (matchedAppointment) {
                    handleScheduleClick(matchedAppointment.id);
                  }
                }
              }}
            />
            {searchQuery && (
              <button 
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                onClick={() => setSearchQuery("")}
              >
                <XCircle className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
        
        {/* Middle: Filters and New Appointment button in a single line - scrollable on small screens */}
        <div className="flex items-center ml-auto space-x-2 overflow-x-auto pb-2 scrollbar-none sm:justify-end">
          {/* New Appointment Button - moved from bottom to be with filters */}
          {import.meta.env.VITE_ENABLE_INTERNAL_WIZARD === 'true' && (
            <Button 
              onClick={() => {
                setEditScheduleId(null);
                // Skip appointment type dialog and open form directly
                // Create date with noon time to prevent timezone date shifts
                const todayNoon = new Date();
                todayNoon.setHours(12, 0, 0, 0);
                setClickedCellDate(todayNoon);
                setIsFormOpen(true);
              }}
              className="bg-primary text-white h-9"
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              New Appointment
            </Button>
          )}
          
          {/* Facility filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                {filterFacilityId.includes("all") ? "All Facilities" : 
                  filterFacilityId.length === 1 ? 
                    facilities.find((f: any) => f.id === filterFacilityId[0])?.name || "Facility" : 
                    `${filterFacilityId.length} Facilities`}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={() => setFilterFacilityId(["all"])}
                className="flex items-center justify-between"
              >
                All Facilities
                {filterFacilityId.includes("all") && <Check className="h-4 w-4 ml-2" />}
              </DropdownMenuItem>
              {facilities.map((facility: any) => <DropdownMenuItem 
                key={facility.id} 
                onClick={() => {
                  // If all was selected and user is now selecting a specific facility
                  if (filterFacilityId.includes("all")) {
                    setFilterFacilityId([facility.id]);
                  } 
                  // If this facility is already selected, toggle it off
                  else if (filterFacilityId.includes(facility.id)) {
                    const newFilterFacilityId = filterFacilityId.filter(id => id !== facility.id);
                    // If nothing is selected after toggling, select "all"
                    if (newFilterFacilityId.length === 0) {
                      setFilterFacilityId(["all"]);
                    } else {
                      setFilterFacilityId(newFilterFacilityId);
                    }
                  } 
                  // Add this facility to the selection
                  else {
                    setFilterFacilityId([...filterFacilityId, facility.id]);
                  }
                }}
                className="flex items-center justify-between"
              >
                {facility.name}
                {filterFacilityId.includes(facility.id) && <Check className="h-4 w-4 ml-2" />}
              </DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Dock filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                {filterDockId.includes("all") ? "All Docks" : 
                  filterDockId.length === 1 ? 
                    docks.find((d: any) => d.id === filterDockId[0])?.name || "Dock" : 
                    `${filterDockId.length} Docks`}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={() => setFilterDockId(["all"])}
                className="flex items-center justify-between"
              >
                All Docks
                {filterDockId.includes("all") && <Check className="h-4 w-4 ml-2" />}
              </DropdownMenuItem>
              {docks
                .filter((dock: any) => filterFacilityId.includes("all") || 
              filterFacilityId.some(facilityId => 
                typeof facilityId === 'number' && dock.facilityId === facilityId)
                )
                .map((dock: any) => <DropdownMenuItem 
                key={dock.id} 
                onClick={() => {
                  // If all was selected and user is now selecting a specific dock
                  if (filterDockId.includes("all")) {
                    setFilterDockId([dock.id]);
                  } 
                  // If this dock is already selected, toggle it off
                  else if (filterDockId.includes(dock.id)) {
                    const newFilterDockId = filterDockId.filter(id => id !== dock.id);
                    // If nothing is selected after toggling, select "all"
                    if (newFilterDockId.length === 0) {
                      setFilterDockId(["all"]);
                    } else {
                      setFilterDockId(newFilterDockId);
                    }
                  } 
                  // Add this dock to the selection
                  else {
                    setFilterDockId([...filterDockId, dock.id]);
                  }
                }}
                className="flex items-center justify-between"
              >
                {dock.name}
                {filterDockId.includes(dock.id) && <Check className="h-4 w-4 ml-2" />}
              </DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Status filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                {filterStatus.includes("all") ? "All Statuses" : 
                  filterStatus.length === 1 ? 
                    `${filterStatus[0].charAt(0).toUpperCase() + filterStatus[0].slice(1)}` : 
                    `${filterStatus.length} Statuses`}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={() => setFilterStatus(["all"])}
                className="flex items-center justify-between"
              >
                All Statuses
                {filterStatus.includes("all") && <Check className="h-4 w-4 ml-2" />}
              </DropdownMenuItem>
              {["scheduled", "in-progress", "completed", "cancelled"].map(status => (
                <DropdownMenuItem 
                  key={status} 
                  onClick={() => {
                    // If all was selected and user is now selecting a specific status
                    if (filterStatus.includes("all")) {
                      setFilterStatus([status]);
                    } 
                    // If this status is already selected, toggle it off
                    else if (filterStatus.includes(status)) {
                      const newFilterStatus = filterStatus.filter(s => s !== status);
                      // If nothing is selected after toggling, select "all"
                      if (newFilterStatus.length === 0) {
                        setFilterStatus(["all"]);
                      } else {
                        setFilterStatus(newFilterStatus);
                      }
                    } 
                    // Add this status to the selection
                    else {
                      setFilterStatus([...filterStatus, status]);
                    }
                  }}
                  className="flex items-center justify-between"
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                  {filterStatus.includes(status) && <Check className="h-4 w-4 ml-2" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Type filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                {filterType.includes("all") ? "All Types" : 
                  filterType.length === 1 ? 
                    `${filterType[0].charAt(0).toUpperCase() + filterType[0].slice(1)}` : 
                    `${filterType.length} Types`}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={() => setFilterType(["all"])}
                className="flex items-center justify-between"
              >
                All Types
                {filterType.includes("all") && <Check className="h-4 w-4 ml-2" />}
              </DropdownMenuItem>
              {["inbound", "outbound"].map(type => (
                <DropdownMenuItem 
                  key={type} 
                  onClick={() => {
                    // If all was selected and user is now selecting a specific type
                    if (filterType.includes("all")) {
                      setFilterType([type]);
                    } 
                    // If this type is already selected, toggle it off
                    else if (filterType.includes(type)) {
                      const newFilterType = filterType.filter(t => t !== type);
                      // If nothing is selected after toggling, select "all"
                      if (newFilterType.length === 0) {
                        setFilterType(["all"]);
                      } else {
                        setFilterType(newFilterType);
                      }
                    } 
                    // Add this type to the selection
                    else {
                      setFilterType([...filterType, type]);
                    }
                  }}
                  className="flex items-center justify-between"
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                  {filterType.includes(type) && <Check className="h-4 w-4 ml-2" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Timezone selector */}
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger className="w-[150px]">
              <SelectValue>
                {getTimeZoneAbbreviation(timezone)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="America/New_York">ET (New York)</SelectItem>
              <SelectItem value="America/Chicago">CT (Chicago)</SelectItem>
              <SelectItem value="America/Denver">MT (Denver)</SelectItem>
              <SelectItem value="America/Los_Angeles">PT (Los Angeles)</SelectItem>
              <SelectItem value="Pacific/Honolulu">HT (Honolulu)</SelectItem>
            </SelectContent>
          </Select>

          {/* 12h/24h Time Format Toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-1">
                <Clock className="h-4 w-4" />
                {timeFormat === "12h" ? "12h" : "24h"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={() => setTimeFormat("12h")}
                className="flex items-center justify-between"
              >
                12-hour
                {timeFormat === "12h" && <Check className="h-4 w-4 ml-2" />}
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setTimeFormat("24h")}
                className="flex items-center justify-between"
              >
                24-hour
                {timeFormat === "24h" && <Check className="h-4 w-4 ml-2" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Clear Filters Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setFilterStatus(["all"]);
              setFilterType(["all"]);
              setFilterFacilityId(["all"]);
              setFilterDockId(["all"]);
            }}
            className="rounded-full"
          >
            <XCircle className="h-5 w-5" />
          </Button>
        </div>
        
        {/* Right side: New Button - REMOVED - now moved to filters section above */}
      </div>
      
      {/* Schedule View */}
      <div className="w-full">
        {viewMode === "week" && (
          <ScheduleWeekCalendar
            schedules={filteredSchedules}
            docks={!filterFacilityId.includes("all") 
              ? docks.filter((dock: any) => filterFacilityId.some(facilityId => 
              typeof facilityId === 'number' && dock.facilityId === facilityId))
              : docks}
            carriers={carriers}
            date={selectedDate}
            timezone={timezone}
            timeFormat={timeFormat}
            onScheduleClick={handleScheduleClick}
            onDateChange={setSelectedDate}
            onViewChange={setViewMode}
            onCellClick={handleCellClick}
          />
        )}
        
        {viewMode === "day" && (
          <ScheduleDayCalendar
            schedules={filteredSchedules}
            docks={!filterFacilityId.includes("all") 
              ? docks.filter((dock: any) => filterFacilityId.some(facilityId => 
              typeof facilityId === 'number' && dock.facilityId === facilityId))
              : docks}
            facilities={facilities}
            date={selectedDate}
            timezone={timezone}
            timeFormat={timeFormat}
            onScheduleClick={handleScheduleClick}
            onDateChange={setSelectedDate}
            onCellClick={handleCellClick}
          />
        )}
        
        {viewMode === "month" && (
          <ScheduleMonthCalendar
            schedules={filteredSchedules}
            docks={!filterFacilityId.includes("all") 
              ? docks.filter((dock: any) => filterFacilityId.some(facilityId => 
              typeof facilityId === 'number' && dock.facilityId === facilityId))
              : docks}
            date={selectedDate}
            timezone={timezone}
            timeFormat={timeFormat}
            onScheduleClick={handleScheduleClick}
            onDateChange={setSelectedDate}
            onCellClick={handleCellClick}
          />
        )}
        
        {viewMode === "calendar" && (
          <ScheduleCalendar 
            schedules={filteredSchedules}
            docks={!filterFacilityId.includes("all") 
              ? docks.filter((dock: any) => filterFacilityId.some(facilityId => 
              typeof facilityId === 'number' && dock.facilityId === facilityId))
              : docks}
            date={selectedDate}
            timezone={timezone}
            timeFormat={timeFormat}
            onScheduleClick={handleScheduleClick}
            onCellClick={handleCellClick}
          />
        )}
        
        {viewMode === "list" && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">
                Calendar List
              </CardTitle>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm">
                  <ListFilter className="h-4 w-4 mr-2" />
                  Filter
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <DataTable 
                columns={columns} 
                data={filteredSchedules} 
                searchKey="truckNumber"
                searchPlaceholder="Search by truck number..."
              />
            </CardContent>
          </Card>
        )}
      </div>
      
      <UnifiedAppointmentFlow 
        mode="internal"
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setClickedCellDate(undefined);
          setSelectedDockId(undefined);  // Reset selected dock when closing form
          setSelectedAppointmentTypeId(undefined); // Reset selected appointment type
        }}
        initialData={scheduleToEdit ? {
          facilityId: scheduleToEdit.facilityId || undefined,
          appointmentTypeId: scheduleToEdit.appointmentTypeId || undefined,
          appointmentDate: scheduleToEdit.startTime ? new Date(scheduleToEdit.startTime) : undefined,
          companyName: scheduleToEdit.customerName || '',
          contactName: scheduleToEdit.customerName || '',
          email: scheduleToEdit.driverEmail || '',
          phone: scheduleToEdit.driverPhone || '',
          carrierName: scheduleToEdit.carrierName || '',
          driverName: scheduleToEdit.driverName || '',
          driverPhone: scheduleToEdit.driverPhone || '',
          driverEmail: scheduleToEdit.driverEmail || '',
          truckNumber: scheduleToEdit.truckNumber || '',
          trailerNumber: scheduleToEdit.trailerNumber || '',
          notes: scheduleToEdit.notes || '',
        } : undefined}
        editMode={editScheduleId ? "edit" : "create"}
        appointmentId={editScheduleId || undefined}
        facilityId={undefined}
        appointmentTypeId={selectedAppointmentTypeId}
        selectedDate={clickedCellDate || selectedDate}
        selectedDockId={selectedDockId}
        timezone={timezone}
        allowAllAppointmentTypes={true}
        onSuccess={(data) => {
          // Refresh the schedules data
          setIsFormOpen(false);
          // Reset form state
          setClickedCellDate(undefined);
          setSelectedDockId(undefined);
          setSelectedAppointmentTypeId(undefined);
          
          toast({
            title: "✅ Success",
            description: `Appointment ${editScheduleId ? 'updated' : 'created'} successfully!`,
            duration: 3000,
          });
        }}
      />
      
      {/* Appointment Details Dialog */}
      <AppointmentDetailsDialog 
        appointment={selectedSchedule as any}
        open={isDetailsDialogOpen}
        onOpenChange={handleDetailsDialogClose}
        facilityName={selectedSchedule ? getFacilityNameForDock(selectedSchedule.dockId, selectedSchedule) : ""}
        timeFormat={timeFormat}
      />
      
      {/* Appointment Type Selection Dialog - hidden, but keeping the component for reference */}
      <Dialog open={false} onOpenChange={() => {
          // Always force this dialog to be closed and go to the form directly
          setIsAppointmentTypeDialogOpen(false);
          setClickedCellDate(new Date());
          setIsFormOpen(true);
        }}>
        <DialogContent className="hidden">
          {/* Dialog content hidden - the dialog will never be shown */}
        </DialogContent>
      </Dialog>
    </div>
  );
}