import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, RefreshCw, Plus, Calendar, Clock, DoorOpen } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";

// Mock data types
interface Dock {
  id: number;
  name: string;
  isActive: boolean;
  type: string;
}

interface Schedule {
  id: number;
  dockId: number;
  carrierId: number;
  truckNumber: string;
  startTime: Date;
  endTime: Date;
  type: "inbound" | "outbound";
  status: string;
}

interface Carrier {
  id: number;
  name: string;
}

// Mock data
const mockDocks: Dock[] = [
  { id: 1, name: "A-01", isActive: true, type: "loading" },
  { id: 2, name: "A-02", isActive: true, type: "unloading" },
  { id: 3, name: "A-03", isActive: false, type: "both" },
  { id: 4, name: "B-01", isActive: true, type: "loading" },
  { id: 5, name: "B-02", isActive: true, type: "unloading" },
  { id: 6, name: "C-01", isActive: true, type: "both" },
];

const mockCarriers: Carrier[] = [
  { id: 1, name: "Acme Logistics" },
  { id: 2, name: "FastFreight Inc." },
  { id: 3, name: "Global Transport Co." },
  { id: 4, name: "MegaMovers" },
];

const currentTime = new Date();
const hour = 60 * 60 * 1000;

const mockSchedules: Schedule[] = [
  {
    id: 1,
    dockId: 1,
    carrierId: 1,
    truckNumber: "AT-12345",
    startTime: new Date(currentTime.getTime() - hour),
    endTime: new Date(currentTime.getTime() + hour),
    type: "inbound",
    status: "in-progress",
  },
  {
    id: 2,
    dockId: 2,
    carrierId: 2,
    truckNumber: "FF-56789",
    startTime: new Date(currentTime.getTime() + (0.5 * hour)),
    endTime: new Date(currentTime.getTime() + (2 * hour)),
    type: "outbound",
    status: "scheduled",
  },
];

// Form schema
const appointmentSchema = z.object({
  dockId: z.number(),
  carrierId: z.number(),
  truckNumber: z.string().min(1, "Truck number is required"),
  startTime: z.date(),
  endTime: z.date(),
  type: z.enum(["inbound", "outbound"]),
  notes: z.string().optional(),
}).refine(data => data.endTime > data.startTime, {
  message: "End time must be after start time",
  path: ["endTime"]
});

type AppointmentValues = z.infer<typeof appointmentSchema>;

export default function BasicDoorManager() {
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"board" | "timeline">("board");
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [selectedDockId, setSelectedDockId] = useState<number | null>(null);
  const [docks, setDocks] = useState(mockDocks);
  const [schedules, setSchedules] = useState(mockSchedules);
  const [carriers, setCarriers] = useState(mockCarriers);
  
  // Door status tracking
  const [doorStatuses, setDoorStatuses] = useState<Array<{
    id: number;
    name: string;
    status: "available" | "occupied" | "reserved" | "maintenance";
    currentSchedule?: Schedule;
    carrier?: string;
    elapsedTime?: number;
    remainingTime?: number;
  }>>([]);
  
  // Process door status data
  useEffect(() => {
    if (docks.length > 0) {
      const now = new Date();
      
      const statuses = docks.map(dock => {
        // Determine door status based on schedules
        let status: "available" | "occupied" | "reserved" | "maintenance" = "available";
        
        // Find current schedule for occupied doors
        const currentSchedule = schedules.find(s => 
          s.dockId === dock.id && 
          new Date(s.startTime) <= now && 
          new Date(s.endTime) >= now
        );
        
        // Find next scheduled appointment for reserved doors
        const nextSchedule = schedules.find(s => 
          s.dockId === dock.id && 
          new Date(s.startTime) > now &&
          new Date(s.startTime).getTime() - now.getTime() < 3600000 // Within the next hour
        );
        
        if (currentSchedule) {
          status = "occupied";
        } else if (nextSchedule) {
          status = "reserved";
        } else if (!dock.isActive) {
          status = "maintenance";
        }
        
        // Calculate elapsed and remaining time for occupied doors
        let elapsedTime: number | undefined;
        let remainingTime: number | undefined;
        
        if (currentSchedule) {
          const startTime = new Date(currentSchedule.startTime);
          const endTime = new Date(currentSchedule.endTime);
          elapsedTime = now.getTime() - startTime.getTime();
          remainingTime = endTime.getTime() - now.getTime();
        }
        
        // Get carrier name
        const carrierName = currentSchedule 
          ? carriers.find(c => c.id === currentSchedule.carrierId)?.name 
          : (nextSchedule ? carriers.find(c => c.id === nextSchedule.carrierId)?.name : undefined);
        
        return {
          id: dock.id,
          name: dock.name,
          status,
          currentSchedule: currentSchedule || nextSchedule,
          carrier: carrierName,
          elapsedTime,
          remainingTime
        };
      });
      
      setDoorStatuses(statuses);
    }
  }, [docks, schedules, carriers, lastUpdated]);
  
  // Handle refresh
  const handleRefresh = () => {
    setLastUpdated(new Date());
  };
  
  // Create an ad-hoc appointment
  const handleCreateAppointment = (dockId: number, timeSlot?: {start: Date, end: Date}) => {
    setSelectedDockId(dockId);
    setShowAppointmentForm(true);
  };
  
  // Form setup
  const form = useForm<AppointmentValues>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      dockId: selectedDockId || 1,
      carrierId: carriers[0]?.id || 1,
      truckNumber: "",
      startTime: new Date(),
      endTime: new Date(new Date().getTime() + hour),
      type: "inbound",
      notes: "",
    },
  });
  
  // Update form values when selectedDockId changes
  useEffect(() => {
    if (selectedDockId) {
      form.setValue("dockId", selectedDockId);
    }
  }, [selectedDockId, form]);
  
  // Close the appointment form
  const handleCloseAppointmentForm = () => {
    setShowAppointmentForm(false);
    setSelectedDockId(null);
    form.reset();
  };
  
  // Handle form submission
  const onSubmit = (data: AppointmentValues) => {
    // Create a new schedule
    const newSchedule: Schedule = {
      id: schedules.length + 1,
      dockId: data.dockId,
      carrierId: data.carrierId,
      truckNumber: data.truckNumber,
      startTime: data.startTime,
      endTime: data.endTime,
      type: data.type,
      status: "scheduled",
    };
    
    // Add to schedules
    setSchedules([...schedules, newSchedule]);
    
    // Close form and refresh
    handleCloseAppointmentForm();
    handleRefresh();
  };
  
  // Format time for display
  const formatTimeForInput = (date: Date) => {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };
  
  // Parse time string to Date object
  const parseTimeString = (timeString: string, baseDate: Date) => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const newDate = new Date(baseDate);
    newDate.setHours(hours, minutes, 0, 0);
    return newDate;
  };
  
  // Set up auto-refresh
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdated(new Date());
    }, 60000); // Refresh every minute
    
    return () => clearInterval(interval);
  }, []);

  // Filter docks based on search term
  const filteredDoors = doorStatuses.filter(door => 
    door.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (door.carrier && door.carrier.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  // Get color class for status indicators
  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-green-500";
      case "occupied":
        return "bg-red-500";
      case "reserved":
        return "bg-yellow-400";
      case "maintenance":
        return "bg-gray-500";
      default:
        return "bg-gray-300";
    }
  };
  
  // Format duration (ms to readable time)
  const formatDuration = (durationMs: number): string => {
    const seconds = Math.floor((durationMs / 1000) % 60);
    const minutes = Math.floor((durationMs / (1000 * 60)) % 60);
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
  
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Get badge variant based on status
  const getStatusBadgeVariant = (status: string): "default" | "destructive" | "secondary" | "outline" => {
    switch (status) {
      case "available":
        return "secondary";
      case "occupied":
        return "destructive";
      case "reserved":
        return "default";
      case "maintenance":
        return "outline";
      default:
        return "outline";
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-medium">Door Manager</h2>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => handleCreateAppointment(docks[0]?.id || 1)}>
            <Plus className="h-4 w-4 mr-2" />
            New Appointment
          </Button>
        </div>
      </div>
      
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between p-4">
          <CardTitle className="text-lg flex items-center gap-2">
            Door Whiteboard
            <Badge variant="outline" className="ml-2">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-sm">Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-sm">Occupied</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
              <span className="text-sm">Reserved</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-500"></div>
              <span className="text-sm">Maintenance</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                type="search"
                placeholder="Search doors..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Tabs
              value={viewMode}
              onValueChange={(value) => setViewMode(value as "board" | "timeline")}
              className="ml-2"
            >
              <TabsList>
                <TabsTrigger value="board">Board</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          
          <TabsContent value="board" className="m-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredDoors.map((door) => (
                <div 
                  key={door.id} 
                  className="border rounded-md h-full bg-white shadow-sm flex flex-col"
                >
                  <div className="p-4 border-b">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-medium text-lg">{door.name}</h3>
                      <Badge variant={getStatusBadgeVariant(door.status)}>
                        <span className={`h-2 w-2 rounded-full ${getStatusColor(door.status)} mr-1.5`}></span>
                        <span className="capitalize">{door.status}</span>
                      </Badge>
                    </div>
                    
                    {door.status === "occupied" && door.carrier && (
                      <div className="mb-2">
                        <p className="text-sm font-medium">{door.carrier}</p>
                        <div className="flex items-center text-xs text-gray-500 mt-1">
                          <Clock className="h-3 w-3 mr-1" />
                          <span>
                            Elapsed: {door.elapsedTime ? formatDuration(door.elapsedTime) : "--:--:--"}
                          </span>
                        </div>
                        {door.remainingTime && (
                          <div className="text-xs text-gray-500 mt-1 ml-4">
                            Remaining: {formatDuration(door.remainingTime)}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {door.status === "reserved" && door.carrier && door.currentSchedule && (
                      <div className="mb-2">
                        <p className="text-sm font-medium">Reserved: {door.carrier}</p>
                        <div className="flex items-center text-xs text-gray-500 mt-1">
                          <Calendar className="h-3 w-3 mr-1" />
                          <span>
                            {format(new Date(door.currentSchedule.startTime), 'HH:mm')}
                            {" - "}
                            {format(new Date(door.currentSchedule.endTime), 'HH:mm')}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {door.status === "available" && (
                      <div className="mb-2">
                        <p className="text-sm text-gray-500">Available for booking</p>
                      </div>
                    )}
                    
                    {door.status === "maintenance" && (
                      <div className="mb-2">
                        <p className="text-sm text-gray-500">Under maintenance</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-3 mt-auto bg-gray-50 flex items-center justify-between">
                    <span className="text-xs text-gray-400">
                      Updated: {format(lastUpdated, 'HH:mm')}
                    </span>
                    
                    {door.status !== "maintenance" && (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="text-xs"
                        onClick={() => handleCreateAppointment(door.id)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        {door.status === "available" ? "Book" : "Update"}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="timeline" className="m-0">
            <div className="flex items-center justify-center p-8 bg-gray-50 rounded-md">
              <div className="flex flex-col items-center gap-2 text-gray-500">
                <Calendar className="h-12 w-12" />
                <p>Timeline view coming soon</p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setViewMode("board")}
                >
                  Switch to Board View
                </Button>
              </div>
            </div>
          </TabsContent>
        </CardContent>
      </Card>
      
      {/* Door Appointment Form Dialog */}
      <Dialog open={showAppointmentForm} onOpenChange={setShowAppointmentForm}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Door Appointment</DialogTitle>
            <DialogDescription>
              Create a new appointment for the selected door. Fill in the details below.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="dockId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Door</FormLabel>
                    <select 
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={field.value}
                      onChange={e => field.onChange(parseInt(e.target.value))}
                    >
                      {docks.map(dock => (
                        <option key={dock.id} value={dock.id}>
                          {dock.name}
                        </option>
                      ))}
                    </select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="carrierId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Carrier</FormLabel>
                    <select 
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={field.value}
                      onChange={e => field.onChange(parseInt(e.target.value))}
                    >
                      {carriers.map(carrier => (
                        <option key={carrier.id} value={carrier.id}>
                          {carrier.name}
                        </option>
                      ))}
                    </select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="truckNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Truck Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter truck number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          value={field.value.toISOString().slice(0, 16)}
                          onChange={(e) => {
                            field.onChange(new Date(e.target.value));
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          value={field.value.toISOString().slice(0, 16)}
                          onChange={(e) => {
                            field.onChange(new Date(e.target.value));
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <select 
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={field.value}
                      onChange={e => field.onChange(e.target.value as "inbound" | "outbound")}
                    >
                      <option value="inbound">Inbound</option>
                      <option value="outbound">Outbound</option>
                    </select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Add any additional notes" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={handleCloseAppointmentForm}>
                  Cancel
                </Button>
                <Button type="submit">
                  Create Appointment
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}