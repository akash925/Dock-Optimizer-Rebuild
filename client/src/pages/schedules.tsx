import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Schedule, Dock, Carrier, Facility, AppointmentType } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, Calendar as CalendarIcon, ListFilter, Grid, List, Eye, Search, XCircle, Clock, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { DataTable } from "@/components/ui/data-table";
import ScheduleCalendar from "@/components/schedules/schedule-calendar";
import ScheduleWeekCalendar from "@/components/schedules/schedule-week-calendar";
import ScheduleDayCalendar from "@/components/schedules/schedule-day-calendar";
import ScheduleMonthCalendar from "@/components/schedules/schedule-month-calendar";
import AppointmentForm from "@/components/schedules/appointment-form";
import { AppointmentDetailsDialog } from "@/components/schedules/appointment-details-dialog";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatTime } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

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
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterFacilityId, setFilterFacilityId] = useState<number | "all">("all");
  const [filterDockId, setFilterDockId] = useState<number | "all">("all");
  const [selectedDockId, setSelectedDockId] = useState<number | undefined>(undefined);
  const [isAppointmentTypeDialogOpen, setIsAppointmentTypeDialogOpen] = useState(false);
  const [selectedAppointmentTypeId, setSelectedAppointmentTypeId] = useState<number | undefined>(undefined);
  
  // Fetch schedules
  const { data: schedules = [] } = useQuery<Schedule[]>({
    queryKey: ["/api/schedules"]
  });
  
  // Set the most current schedule as selected on first load
  // Check for schedule ID in URL params
  const [, params] = useParams();
  
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
  
  // Get facility name for a dock
  const getFacilityNameForDock = (dockId: number | null): string => {
    if (!dockId) return "No dock assigned";
    const dock = docks.find(d => d.id === dockId);
    if (!dock) return "Unknown Facility";
    
    const facility = facilities.find(f => f.id === dock.facilityId);
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
        dockName: schedule.dockId ? docks.find(d => d.id === schedule.dockId)?.name : undefined,
        appointmentTypeName: schedule.appointmentTypeId ? appointmentTypes.find(t => t.id === schedule.appointmentTypeId)?.name : undefined
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
      
      // Open appointment type selection dialog first
      setIsAppointmentTypeDialogOpen(true);
    } else {
      console.error("Invalid date received from cell click:", date);
      // Fallback to current date/time if we got an invalid date
      setClickedCellDate(new Date());
      setIsAppointmentTypeDialogOpen(true);
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
    const appointmentType = appointmentTypes.find(type => type.id === appointmentTypeId);
    
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
      cell: ({ row }) => {
        const carrierId = row.getValue("carrierId") as number;
        const carrier = carriers.find(c => c.id === carrierId);
        return carrier?.name || "Unknown";
      },
    },
    {
      accessorKey: "dockId",
      header: "Dock",
      cell: ({ row }) => {
        const dockId = row.getValue("dockId") as number;
        const dock = docks.find(d => d.id === dockId);
        return dock?.name || "Unknown";
      },
    },
    {
      accessorKey: "startTime",
      header: "Start Time",
      cell: ({ row }) => {
        const startTime = row.getValue("startTime") as string;
        return formatTime(startTime);
      },
    },
    {
      accessorKey: "endTime",
      header: "End Time",
      cell: ({ row }) => {
        const endTime = row.getValue("endTime") as string;
        return formatTime(endTime);
      },
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => {
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
      cell: ({ row }) => {
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
      cell: ({ row }) => {
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
  
  // Filter and search schedules
  const filteredSchedules = schedules.filter((schedule: Schedule) => {
    // Date filter - always applied
    const scheduleDate = new Date(schedule.startTime);
    const dateMatches = 
      scheduleDate.getDate() === selectedDate.getDate() &&
      scheduleDate.getMonth() === selectedDate.getMonth() &&
      scheduleDate.getFullYear() === selectedDate.getFullYear();
    
    // Status filter
    const statusMatches = filterStatus === "all" || schedule.status === filterStatus;
    
    // Type filter
    const typeMatches = filterType === "all" || schedule.type === filterType;

    // Facility filter - this requires looking up the dock's facility
    let facilityMatches = true;
    if (filterFacilityId !== "all") {
      if (!schedule.dockId) {
        // If no dock assigned and filtering by facility, don't show
        facilityMatches = false;
      } else {
        // Get dock and check if it belongs to the selected facility
        const dock = docks.find(d => d.id === schedule.dockId);
        facilityMatches = dock?.facilityId === filterFacilityId;
      }
    }
    
    // Dock filter
    const dockMatches = filterDockId === "all" || schedule.dockId === filterDockId;
    
    // Search query - check multiple fields
    let searchMatches = true;
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      const carrier = carriers.find(c => c.id === schedule.carrierId);
      
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
  });

  return (
    <div>
      {/* Consolidated Header Row */}
      <div className="flex items-center mb-6 gap-3">
        {/* Left side: Title and Search */}
        <h2 className="text-xl font-medium whitespace-nowrap">Calendar</h2>
        <div className="relative flex-grow max-w-xs">
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
        
        {/* Middle: Filters in a single line */}
        <div className="flex items-center gap-2">
          {/* Facility Filter */}
          <Select 
            value={filterFacilityId === "all" ? "all" : filterFacilityId.toString()} 
            onValueChange={(value) => {
              const newFacilityId = value === "all" ? "all" : parseInt(value);
              setFilterFacilityId(newFacilityId);
              // Reset dock filter when facility changes
              setFilterDockId("all");
            }}
          >
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="All Facilities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Facilities</SelectItem>
              {facilities.map((facility) => (
                <SelectItem key={facility.id} value={facility.id.toString()}>
                  {facility.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Dock Filter */}
          <Select 
            value={filterDockId === "all" ? "all" : filterDockId.toString()} 
            onValueChange={(value) => setFilterDockId(value === "all" ? "all" : parseInt(value))}
          >
            <SelectTrigger className="w-[120px] h-9">
              <SelectValue placeholder="All Docks" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Docks</SelectItem>
              {docks
                .filter(dock => filterFacilityId === "all" || dock.facilityId === filterFacilityId)
                .map((dock) => (
                  <SelectItem key={dock.id} value={dock.id.toString()}>
                    {dock.name}
                  </SelectItem>
                ))
              }
            </SelectContent>
          </Select>
          
          {/* Status Filter */}
          <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value)}>
            <SelectTrigger className="w-[120px] h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          
          {/* Type Filter */}
          <Select value={filterType} onValueChange={(value) => setFilterType(value)}>
            <SelectTrigger className="w-[120px] h-9">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="inbound">Inbound</SelectItem>
              <SelectItem value="outbound">Outbound</SelectItem>
            </SelectContent>
          </Select>
          
          {/* Clear Filters */}
          {(searchQuery || filterStatus !== "all" || filterType !== "all" || 
            filterDockId !== "all" || filterFacilityId !== "all") && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                setSearchQuery("");
                setFilterStatus("all");
                setFilterType("all");
                setFilterFacilityId("all");
                setFilterDockId("all");
              }}
              className="text-xs h-9"
            >
              Clear Filters
            </Button>
          )}
        </div>
        
        {/* Right side: New Button */}
        <Button 
          onClick={() => {
            setEditScheduleId(null);
            setIsAppointmentTypeDialogOpen(true);
          }}
          className="bg-primary text-white h-9 ml-auto"
        >
          <PlusCircle className="h-4 w-4 mr-2" />
          New Appointment
        </Button>
      </div>
      
      {/* Schedule View */}
      <div className="w-full">
        {viewMode === "week" && (
          <ScheduleWeekCalendar
            schedules={(filterStatus !== "all" || filterType !== "all" || 
                      filterDockId !== "all" || filterFacilityId !== "all" || 
                      searchQuery.trim() !== "") 
              ? filteredSchedules 
              : (schedules as Schedule[])}
            docks={filterFacilityId !== "all" 
              ? docks.filter(dock => dock.facilityId === filterFacilityId)
              : docks}
            carriers={carriers}
            date={selectedDate}
            onScheduleClick={handleScheduleClick}
            onDateChange={setSelectedDate}
            onViewChange={setViewMode}
            onCellClick={handleCellClick}
          />
        )}
        
        {viewMode === "day" && (
          <ScheduleDayCalendar
            schedules={(filterStatus !== "all" || filterType !== "all" || 
                      filterDockId !== "all" || filterFacilityId !== "all" || 
                      searchQuery.trim() !== "") 
              ? filteredSchedules 
              : (schedules as Schedule[])}
            docks={filterFacilityId !== "all" 
              ? docks.filter(dock => dock.facilityId === filterFacilityId)
              : docks}
            date={selectedDate}
            onScheduleClick={handleScheduleClick}
            onDateChange={setSelectedDate}
            onCellClick={handleCellClick}
          />
        )}
        
        {viewMode === "month" && (
          <ScheduleMonthCalendar
            schedules={(filterStatus !== "all" || filterType !== "all" || 
                      filterDockId !== "all" || filterFacilityId !== "all" || 
                      searchQuery.trim() !== "") 
              ? filteredSchedules 
              : (schedules as Schedule[])}
            docks={filterFacilityId !== "all" 
              ? docks.filter(dock => dock.facilityId === filterFacilityId)
              : docks}
            date={selectedDate}
            onScheduleClick={handleScheduleClick}
            onDateChange={setSelectedDate}
            onCellClick={handleCellClick}
          />
        )}
        
        {viewMode === "calendar" && (
          <ScheduleCalendar 
            schedules={filteredSchedules}
            docks={filterFacilityId !== "all" 
              ? docks.filter(dock => dock.facilityId === filterFacilityId)
              : docks}
            date={selectedDate}
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
                data={schedules as Schedule[]} 
                searchKey="truckNumber"
                searchPlaceholder="Search by truck number..."
              />
            </CardContent>
          </Card>
        )}
      </div>
      
      <AppointmentForm 
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setClickedCellDate(undefined);
          setSelectedDockId(undefined);  // Reset selected dock when closing form
          setSelectedAppointmentTypeId(undefined); // Reset selected appointment type
        }}
        initialData={scheduleToEdit}
        mode={editScheduleId ? "edit" : "create"}
        initialDate={clickedCellDate || selectedDate}
        initialDockId={selectedDockId}  // Pass the selected dock to the form
        appointmentTypeId={selectedAppointmentTypeId} // Pass the selected appointment type
      />
      
      {/* Appointment Details Dialog */}
      <AppointmentDetailsDialog 
        appointment={selectedSchedule}
        open={isDetailsDialogOpen}
        onOpenChange={setIsDetailsDialogOpen}
        facilityName={selectedSchedule ? getFacilityNameForDock(selectedSchedule.dockId) : ""}
      />
      
      {/* Appointment Type Selection Dialog */}
      <Dialog open={isAppointmentTypeDialogOpen} onOpenChange={setIsAppointmentTypeDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="text-2xl font-semibold">Select Appointment Type</DialogTitle>
            <DialogDescription>
              Choose the type of appointment you'd like to schedule.
            </DialogDescription>
          </DialogHeader>
          {/* Facility selector for appointment types */}
          <div className="px-6 pb-2 pt-1">
            <Select 
              value={filterFacilityId === "all" ? "all" : filterFacilityId.toString()} 
              onValueChange={(value) => {
                const newFacilityId = value === "all" ? "all" : parseInt(value);
                setFilterFacilityId(newFacilityId);
                setFilterDockId("all");
              }}
            >
              <SelectTrigger className="w-full font-medium">
                <SelectValue placeholder="Select facility" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Facilities</SelectItem>
                {facilities.map((facility) => (
                  <SelectItem key={facility.id} value={facility.id.toString()}>
                    {facility.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="py-2">
            {/* Filter appointment types by selected facility */}
            {(() => {
              // Get the filtered appointment types based on selected facility
              const filteredTypes = filterFacilityId === "all" 
                ? appointmentTypes 
                : appointmentTypes.filter(type => type.facilityId === filterFacilityId);
              
              if (filteredTypes.length > 0) {
                return (
                  <div className="divide-y divide-gray-100">
                    {filteredTypes.map((type) => {
                      // Determine the facility name for this appointment type
                      const facility = facilities.find(f => f.id === type.facilityId);
                      const facilityName = facility?.name || "Unknown Location";
                      
                      // Create badge for inbound/outbound/both
                      let typeLabel = "";
                      let typeColor = "";
                      if (type.type.toLowerCase() === 'inbound') {
                        typeLabel = "Inbound";
                        typeColor = "bg-blue-100 text-blue-800";
                      } else if (type.type.toLowerCase() === 'outbound') {
                        typeLabel = "Outbound";
                        typeColor = "bg-purple-100 text-purple-800";
                      } else {
                        typeLabel = "Inbound/Outbound";
                        typeColor = "bg-gray-100 text-gray-800";
                      }
                      
                      return (
                        <button
                          key={type.id}
                          className="w-full px-6 py-4 hover:bg-gray-50 focus:outline-none focus:bg-gray-50 transition-colors flex items-start justify-between group"
                          onClick={() => handleAppointmentTypeSelected(type.id)}
                        >
                          <div className="flex items-start w-full">
                            {/* Left color bar */}
                            <div 
                              className="w-1.5 self-stretch mr-4 rounded-full flex-shrink-0" 
                              style={{ backgroundColor: type.color || '#888' }}
                            />
                            
                            {/* Content */}
                            <div className="flex-1">
                              <div className="flex justify-between w-full">
                                <h3 className="font-semibold text-lg">{type.name}</h3>
                                <span className="text-sm text-gray-500 flex items-center">
                                  <Clock className="h-4 w-4 mr-1.5" />
                                  {type.duration} min
                                </span>
                              </div>
                              
                              <p className="text-sm text-gray-600 mt-1 mb-2">
                                {type.description || 'No description available'}
                              </p>
                              
                              <div className="flex items-center">
                                <span className={`text-xs px-2 py-1 rounded-full ${typeColor}`}>
                                  {typeLabel}
                                </span>
                                <span className="mx-2 text-gray-300">•</span>
                                <span className="text-xs text-gray-500">
                                  {facilityName}
                                </span>
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              } else if (filterFacilityId !== "all") {
                return (
                  <div className="text-center p-8 border-t">
                    <p className="text-muted-foreground">No appointment types available for this facility.</p>
                    <p className="text-sm mt-2">
                      Please select a different facility or configure appointment types in the Appointment Master section.
                    </p>
                  </div>
                );
              } else {
                return (
                  <div className="text-center p-8 border-t">
                    <p className="text-muted-foreground">No appointment types available.</p>
                    <p className="text-sm mt-2">
                      Please configure appointment types in the Appointment Master section.
                    </p>
                  </div>
                );
              }
            })()}
          </div>
          <div className="flex justify-end p-6 border-t">
            <Button variant="outline" onClick={() => setIsAppointmentTypeDialogOpen(false)} className="px-4">
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}