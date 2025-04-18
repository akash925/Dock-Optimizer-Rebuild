import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Schedule, Dock, Carrier, Facility } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, Calendar as CalendarIcon, ListFilter, Grid, List, Eye, Search, XCircle } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { DataTable } from "@/components/ui/data-table";
import ScheduleCalendar from "@/components/schedules/schedule-calendar";
import ScheduleWeekCalendar from "@/components/schedules/schedule-week-calendar";
import AppointmentForm from "@/components/schedules/appointment-form";
import { AppointmentDetailsDialog } from "@/components/schedules/appointment-details-dialog";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatTime } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";

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
  const [filterDockId, setFilterDockId] = useState<number | "all">("all");
  const [selectedDockId, setSelectedDockId] = useState<number | undefined>(undefined);
  
  // Fetch schedules
  const { data: schedules = [] } = useQuery<Schedule[]>({
    queryKey: ["/api/schedules"]
  });
  
  // Set the most current schedule as selected on first load
  useEffect(() => {
    if (schedules.length > 0 && !selectedSchedule) {
      setSelectedSchedule(schedules[0]);
    }
  }, [schedules, selectedSchedule]);
  
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
  
  // Get facility name for a dock
  const getFacilityNameForDock = (dockId: number): string => {
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
      setSelectedSchedule(schedule);
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
      
      setIsFormOpen(true);
    } else {
      console.error("Invalid date received from cell click:", date);
      // Fallback to current date/time if we got an invalid date
      setClickedCellDate(new Date());
      setIsFormOpen(true);
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
    
    return dateMatches && statusMatches && typeMatches && dockMatches && searchMatches;
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-medium">Calendar</h2>
        <Button 
          onClick={() => {
            setEditScheduleId(null);
            setIsFormOpen(true);
          }}
          className="bg-primary text-white"
        >
          <PlusCircle className="h-4 w-4 mr-2" />
          New Appointment
        </Button>
      </div>
      
      {/* Search and Filter Bar */}
      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <div className="relative w-full md:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search appointments..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
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
        
        <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value)}>
          <SelectTrigger className="w-[140px]">
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
        
        <Select value={filterType} onValueChange={(value) => setFilterType(value)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="inbound">Inbound</SelectItem>
            <SelectItem value="outbound">Outbound</SelectItem>
          </SelectContent>
        </Select>
        
        <Select 
          value={filterDockId === "all" ? "all" : filterDockId.toString()} 
          onValueChange={(value) => setFilterDockId(value === "all" ? "all" : parseInt(value))}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Dock" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Docks</SelectItem>
            {docks.map((dock) => (
              <SelectItem key={dock.id} value={dock.id.toString()}>
                {dock.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {(searchQuery || filterStatus !== "all" || filterType !== "all" || filterDockId !== "all") && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => {
              setSearchQuery("");
              setFilterStatus("all");
              setFilterType("all");
              setFilterDockId("all");
            }}
            className="text-xs"
          >
            Clear Filters
          </Button>
        )}
      </div>
      
      {/* Schedule View */}
      <div className="w-full">
        {viewMode === "week" && (
          <ScheduleWeekCalendar
            schedules={(filterStatus !== "all" || filterType !== "all" || filterDockId !== "all" || searchQuery.trim() !== "") 
              ? filteredSchedules 
              : (schedules as Schedule[])}
            docks={docks}
            carriers={carriers}
            date={selectedDate}
            onScheduleClick={handleScheduleClick}
            onDateChange={setSelectedDate}
            onViewChange={setViewMode}
            onCellClick={handleCellClick}
          />
        )}
        
        {viewMode === "calendar" && (
          <ScheduleCalendar 
            schedules={filteredSchedules}
            docks={docks}
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
        }}
        initialData={scheduleToEdit}
        mode={editScheduleId ? "edit" : "create"}
        initialDate={clickedCellDate || selectedDate}
        initialDockId={selectedDockId}  // Pass the selected dock to the form
      />
      
      {/* Appointment Details Dialog */}
      <AppointmentDetailsDialog 
        appointment={selectedSchedule}
        open={isDetailsDialogOpen}
        onOpenChange={setIsDetailsDialogOpen}
        facilityName={selectedSchedule ? getFacilityNameForDock(selectedSchedule.dockId) : ""}
      />
    </div>
  );
}