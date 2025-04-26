import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Calendar,
  Loader2,
  Plus,
  FileText,
  Truck,
  Clock,
  MapPin,
  Copy,
  Download,
  Search,
  Filter,
  Calendar as CalendarIcon,
  X,
} from "lucide-react";
import { formatDate, formatTime, getDockStatus } from "@/lib/utils";
import { Schedule } from "@shared/schema";
import * as XLSX from 'xlsx';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format, subDays, addDays } from "date-fns";

export default function AppointmentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Filter states
  const [dateRange, setDateRange] = useState<{ start: Date | undefined; end: Date | undefined }>({
    // Default to previous week
    start: subDays(new Date(), 7),
    end: new Date(),
  });
  const [customerFilter, setCustomerFilter] = useState<string>("all");
  const [carrierFilter, setCarrierFilter] = useState<string>("all");
  const [facilityFilter, setFacilityFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  
  // Fetch all schedules
  const { data: schedules, isLoading, error } = useQuery({
    queryKey: ["/api/schedules"],
    queryFn: async () => {
      const response = await fetch("/api/schedules");
      if (!response.ok) {
        throw new Error("Failed to fetch schedules");
      }
      return response.json() as Promise<Schedule[]>;
    },
  });
  
  // Fetch all docks
  const { data: docks } = useQuery({
    queryKey: ["/api/docks"],
    queryFn: async () => {
      const response = await fetch("/api/docks");
      if (!response.ok) {
        throw new Error("Failed to fetch docks");
      }
      return response.json();
    },
  });
  
  // Fetch all carriers
  const { data: carriers } = useQuery({
    queryKey: ["/api/carriers"],
    queryFn: async () => {
      const response = await fetch("/api/carriers");
      if (!response.ok) {
        throw new Error("Failed to fetch carriers");
      }
      return response.json();
    },
  });
  
  // Fetch all facilities for location filter
  const { data: facilities } = useQuery({
    queryKey: ["/api/facilities"],
    queryFn: async () => {
      const response = await fetch("/api/facilities");
      if (!response.ok) {
        throw new Error("Failed to fetch facilities");
      }
      return response.json();
    },
  });
  
  // Fetch appointment types for type filter
  const { data: appointmentTypes } = useQuery({
    queryKey: ["/api/appointment-types"],
    queryFn: async () => {
      const response = await fetch("/api/appointment-types");
      if (!response.ok) {
        throw new Error("Failed to fetch appointment types");
      }
      return response.json();
    },
  });
  
  // Delete schedule mutation
  const deleteScheduleMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/schedules/${id}`);
      return res.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      toast({
        title: "Success",
        description: "Appointment deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to delete appointment: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  // Duplicate schedule mutation
  const duplicateScheduleMutation = useMutation({
    mutationFn: async (schedule: Schedule) => {
      // Create a new schedule based on the existing one
      const newSchedule = {
        ...schedule,
        // Remove ID so a new one is created
        id: undefined,
        // Update timestamps if needed
        createdAt: new Date(),
        createdBy: user?.id || 1,
        lastModifiedAt: null,
        lastModifiedBy: null,
        // You can customize the new start/end times or leave them as is
        // For example, you might want to schedule it for the next day
        status: "scheduled"
      };
      
      const res = await apiRequest("POST", "/api/schedules", newSchedule);
      if (!res.ok) {
        throw new Error("Failed to duplicate appointment");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      toast({
        title: "Success",
        description: "Appointment duplicated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to duplicate appointment: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  const handleEditClick = (schedule: Schedule) => {
    // For now, we'll just redirect to the schedule page with the ID
    window.location.href = `/schedules?edit=${schedule.id}`;
  };
  
  const handleDeleteClick = (schedule: Schedule) => {
    deleteScheduleMutation.mutate(schedule.id);
  };
  
  const handleDuplicateClick = (schedule: Schedule) => {
    duplicateScheduleMutation.mutate(schedule);
  };
  
  // Get appointment type badge
  const getAppointmentTypeBadge = (type: string) => {
    switch (type.toLowerCase()) {
      case "inbound":
        return <Badge className="bg-green-500">Inbound</Badge>;
      case "outbound":
        return <Badge className="bg-blue-500">Outbound</Badge>;
      default:
        return <Badge>{type}</Badge>;
    }
  };
  
  // Get appointment status badge
  const getAppointmentStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "scheduled":
        return <Badge variant="outline" className="border-blue-500 text-blue-500">Scheduled</Badge>;
      case "in-progress":
        return <Badge variant="outline" className="border-yellow-500 text-yellow-500">In Progress</Badge>;
      case "completed":
        return <Badge variant="outline" className="border-green-500 text-green-500">Completed</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="border-red-500 text-red-500">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  // Get dock name from ID
  const getDockName = (dockId: number | null) => {
    if (!dockId) return "No dock assigned";
    if (!docks) return "Loading...";
    const dock = docks.find((d: any) => d.id === dockId);
    return dock ? dock.name : `Dock #${dockId}`;
  };
  
  // Get carrier name from ID
  const getCarrierName = (carrierId: number) => {
    if (!carriers) return "Loading...";
    const carrier = carriers.find((c: any) => c.id === carrierId);
    return carrier ? carrier.name : `Carrier #${carrierId}`;
  };
  
  // Filter and sort schedules
  const filteredSchedules = useMemo(() => {
    if (!schedules) return [];
    
    return schedules.filter(schedule => {
      const scheduleDate = new Date(schedule.startTime);
      
      // Date range filter
      if (dateRange.start && scheduleDate < dateRange.start) return false;
      if (dateRange.end) {
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59, 999); // End of day
        if (scheduleDate > endDate) return false;
      }
      
      // Customer filter
      if (customerFilter !== "all" && 
          schedule.customerName && 
          !schedule.customerName.toLowerCase().includes(customerFilter.toLowerCase())) {
        return false;
      }
      
      // Carrier filter
      if (carrierFilter !== "all" && schedule.carrierId) {
        const carrierName = getCarrierName(schedule.carrierId).toLowerCase();
        if (!carrierName.includes(carrierFilter.toLowerCase())) {
          return false;
        }
      }
      
      // Facility filter
      if (facilityFilter !== "all" && schedule.dockId) {
        const dock = docks?.find((d: any) => d.id === schedule.dockId);
        if (dock) {
          const facility = facilities?.find((f: any) => f.id === dock.facilityId);
          const facilityName = facility ? facility.name.toLowerCase() : "";
          if (!facilityName.includes(facilityFilter.toLowerCase())) {
            return false;
          }
        }
      }
      
      // Type filter
      if (typeFilter !== "all" && schedule.type && schedule.type !== typeFilter) {
        return false;
      }
      
      // Search query (searches across multiple fields)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesQuery = 
          (schedule.customerName && schedule.customerName.toLowerCase().includes(query)) ||
          (schedule.truckNumber && schedule.truckNumber.toLowerCase().includes(query)) ||
          (schedule.trailerNumber && schedule.trailerNumber.toLowerCase().includes(query)) ||
          (schedule.carrierName && schedule.carrierName.toLowerCase().includes(query)) ||
          (schedule.poNumber && schedule.poNumber.toLowerCase().includes(query)) ||
          (schedule.bolNumber && schedule.bolNumber.toLowerCase().includes(query));
        
        if (!matchesQuery) return false;
      }
      
      return true;
    }).sort((a, b) => 
      new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
  }, [schedules, dateRange, customerFilter, carrierFilter, facilityFilter, typeFilter, searchQuery, facilities]);
  
  // Create list of unique values for filters
  const customerList = useMemo(() => {
    if (!schedules) return [];
    const customers = schedules
      .map(s => s.customerName)
      .filter((name): name is string => !!name);
    return Array.from(new Set(customers)).sort();
  }, [schedules]);
  
  // Export to Excel
  const handleExportExcel = () => {
    if (!filteredSchedules.length) {
      toast({
        title: "No data to export",
        description: "Please adjust your filters to include some appointments",
        variant: "destructive",
      });
      return;
    }
    
    const exportData = filteredSchedules.map(schedule => ({
      "Event Date": formatDate(schedule.startTime),
      "Event Time": formatTime(schedule.startTime),
      "Event Type": schedule.type,
      "Location": getDockName(schedule.dockId),
      "Carrier Name": getCarrierName(schedule.carrierId),
      "MC #": schedule.mcNumber || "",
      "Truck Number": schedule.truckNumber,
      "Customer Name": schedule.customerName || "",
      "Is Cancelled": schedule.status === "cancelled" ? "true" : "false",
      "Is Rescheduled": "false", // We don't have this info currently
      "BOL Number": schedule.bolNumber || "",
      "PO Number": schedule.poNumber || "",
      "Status": schedule.status,
    }));
    
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Appointments");
    
    // Generate filename with current date
    const dateStr = format(new Date(), "yyyy-MM-dd");
    XLSX.writeFile(workbook, `Dock-Appointments-${dateStr}.xlsx`);
    
    toast({
      title: "Export successful",
      description: `Exported ${exportData.length} appointments to Excel`,
    });
  };
  
  // Export to CSV
  const handleExportCSV = () => {
    if (!filteredSchedules.length) {
      toast({
        title: "No data to export",
        description: "Please adjust your filters to include some appointments",
        variant: "destructive",
      });
      return;
    }
    
    const exportData = filteredSchedules.map(schedule => ({
      "Event Date": formatDate(schedule.startTime),
      "Event Time": formatTime(schedule.startTime),
      "Event Type": schedule.type,
      "Location": getDockName(schedule.dockId),
      "Carrier Name": getCarrierName(schedule.carrierId),
      "MC #": schedule.mcNumber || "",
      "Truck Number": schedule.truckNumber,
      "Customer Name": schedule.customerName || "",
      "Is Cancelled": schedule.status === "cancelled" ? "true" : "false",
      "Is Rescheduled": "false", // We don't have this info currently
      "BOL Number": schedule.bolNumber || "",
      "PO Number": schedule.poNumber || "",
      "Status": schedule.status,
    }));
    
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    
    // Create downloadable blob
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Generate filename with current date
    const dateStr = format(new Date(), "yyyy-MM-dd");
    link.setAttribute('download', `Dock-Appointments-${dateStr}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Export successful",
      description: `Exported ${exportData.length} appointments to CSV`,
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Error loading appointments: {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Appointments</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportExcel}>
            <Download className="mr-2 h-4 w-4" /> Export Excel
          </Button>
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
          <Button onClick={() => window.location.href = "/schedules"}>
            <Plus className="mr-2 h-4 w-4" /> New Appointment
          </Button>
        </div>
      </div>
      
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="mr-2 h-5 w-5" /> Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Date Range */}
            <div className="space-y-2">
              <div className="font-medium text-sm">Date Range</div>
              <div className="flex gap-2 items-center">
                <Input
                  type="date"
                  value={dateRange.start ? format(dateRange.start, "yyyy-MM-dd") : ""}
                  onChange={(e) => {
                    if (e.target.value) {
                      setDateRange({ 
                        ...dateRange, 
                        start: new Date(e.target.value) 
                      });
                    } else {
                      setDateRange({ 
                        ...dateRange, 
                        start: undefined 
                      });
                    }
                  }}
                  className="w-full"
                />
                <span>to</span>
                <Input
                  type="date"
                  value={dateRange.end ? format(dateRange.end, "yyyy-MM-dd") : ""}
                  onChange={(e) => {
                    if (e.target.value) {
                      const date = new Date(e.target.value);
                      date.setHours(23, 59, 59, 999); // Set to end of day
                      setDateRange({ 
                        ...dateRange, 
                        end: date 
                      });
                    } else {
                      setDateRange({ 
                        ...dateRange, 
                        end: undefined 
                      });
                    }
                  }}
                  className="w-full"
                />
              </div>
            </div>
            
            {/* Customer */}
            <div className="space-y-2">
              <div className="font-medium text-sm">Customer</div>
              <Select
                value={customerFilter}
                onValueChange={setCustomerFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All customers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All customers</SelectItem>
                  {customerList.map(customer => (
                    <SelectItem key={customer} value={customer}>{customer}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Carrier */}
            <div className="space-y-2">
              <div className="font-medium text-sm">Carrier</div>
              <Select
                value={carrierFilter}
                onValueChange={setCarrierFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All carriers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All carriers</SelectItem>
                  {carriers?.map((carrier: any) => (
                    <SelectItem key={carrier.id} value={carrier.name}>{carrier.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Facility */}
            <div className="space-y-2">
              <div className="font-medium text-sm">Facility</div>
              <Select
                value={facilityFilter}
                onValueChange={setFacilityFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All facilities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All facilities</SelectItem>
                  {facilities?.map((facility: any) => (
                    <SelectItem key={facility.id} value={facility.name}>{facility.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Type */}
            <div className="space-y-2">
              <div className="font-medium text-sm">Appointment Type</div>
              <Select
                value={typeFilter}
                onValueChange={setTypeFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="inbound">Inbound</SelectItem>
                  <SelectItem value="outbound">Outbound</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Search */}
            <div className="space-y-2 md:col-span-2">
              <div className="font-medium text-sm">Search</div>
              <div className="flex gap-2">
                <Input
                  placeholder="Search by customer, truck #, BOL, PO, etc."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSearchQuery("")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            
            {/* Reset Filters */}
            <div className="md:col-span-2 flex items-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setDateRange({ 
                    start: subDays(new Date(), 7), 
                    end: new Date() 
                  });
                  setCustomerFilter("all");
                  setCarrierFilter("all");
                  setFacilityFilter("all");
                  setTypeFilter("all");
                  setSearchQuery("");
                }}
              >
                Reset Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Appointments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Appointment Log</CardTitle>
          <CardDescription>
            Showing {filteredSchedules.length} appointments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event Date</TableHead>
                <TableHead>Event Time</TableHead>
                <TableHead>Event Type</TableHead>
                <TableHead>Facility</TableHead>
                <TableHead>Carrier</TableHead>
                <TableHead>MC #</TableHead>
                <TableHead>Truck #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSchedules.map((schedule) => (
                <TableRow key={schedule.id}>
                  <TableCell>
                    <div className="font-medium">{formatDate(schedule.startTime)}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-muted-foreground">{formatTime(schedule.startTime)}</div>
                  </TableCell>
                  <TableCell>{getAppointmentTypeBadge(schedule.type)}</TableCell>
                  <TableCell>{getDockName(schedule.dockId)}</TableCell>
                  <TableCell>{getCarrierName(schedule.carrierId)}</TableCell>
                  <TableCell>{schedule.mcNumber || "-"}</TableCell>
                  <TableCell>{schedule.truckNumber}</TableCell>
                  <TableCell>{schedule.customerName || "-"}</TableCell>
                  <TableCell>{getAppointmentStatusBadge(schedule.status)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => window.location.href = `/schedules?edit=${schedule.id}`}>
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              
              {filteredSchedules.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Calendar className="h-10 w-10 mb-2" />
                      <p>No appointments found</p>
                      <Button variant="link" onClick={() => window.location.href = "/schedules"}>
                        Create your first appointment
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {/* Additional Cards for Quick Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <Truck className="mr-2 h-5 w-5" /> Today's Appointments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {filteredSchedules.filter((s: Schedule) => 
                new Date(s.startTime).toDateString() === new Date().toDateString()
              ).length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <Clock className="mr-2 h-5 w-5" /> Upcoming (Next 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {filteredSchedules.filter((s: Schedule) => {
                const scheduleDate = new Date(s.startTime);
                const today = new Date();
                const nextWeek = new Date();
                nextWeek.setDate(today.getDate() + 7);
                return scheduleDate >= today && scheduleDate <= nextWeek;
              }).length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <MapPin className="mr-2 h-5 w-5" /> Available Docks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {docks?.filter((d: any) => d.isActive).length || 0}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}