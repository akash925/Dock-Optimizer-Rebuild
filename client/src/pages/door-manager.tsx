import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dock, Schedule, Carrier } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, RefreshCw, Plus, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import DoorBoard from "../components/door-manager/door-board";
import DoorAppointmentForm from "../components/door-manager/door-appointment-form";

export default function DoorManager() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"board" | "timeline">("board");
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [selectedDockId, setSelectedDockId] = useState<number | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{start: Date, end: Date} | null>(null);
  
  // Fetch docks
  const { data: docks = [], refetch: refetchDocks } = useQuery<Dock[]>({
    queryKey: ["/api/docks"],
  });
  
  // Fetch schedules
  const { data: schedules = [], refetch: refetchSchedules } = useQuery<Schedule[]>({
    queryKey: ["/api/schedules"],
  });
  
  // Fetch carriers
  const { data: carriers = [] } = useQuery<Carrier[]>({
    queryKey: ["/api/carriers"],
  });
  
  // Handle refresh
  const handleRefresh = async () => {
    await Promise.all([refetchDocks(), refetchSchedules()]);
    setLastUpdated(new Date());
    toast({
      title: "Refreshed",
      description: "Door status has been updated.",
    });
  };
  
  // Create an ad-hoc appointment
  const handleCreateAppointment = (dockId: number, timeSlot?: {start: Date, end: Date}) => {
    setSelectedDockId(dockId);
    if (timeSlot) {
      setSelectedTimeSlot(timeSlot);
    } else {
      // Default to 1 hour from now if no time slot is provided
      const start = new Date();
      const end = new Date();
      end.setHours(end.getHours() + 1);
      setSelectedTimeSlot({ start, end });
    }
    setShowAppointmentForm(true);
  };
  
  // Close the appointment form
  const handleCloseAppointmentForm = () => {
    setShowAppointmentForm(false);
    setSelectedDockId(null);
    setSelectedTimeSlot(null);
  };
  
  // Set up auto-refresh
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdated(new Date());
    }, 60000); // Refresh every minute
    
    return () => clearInterval(interval);
  }, []);

  // Filter docks based on search term
  const filteredDocks = docks.filter(dock => 
    dock.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-medium">Door Manager</h2>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => handleCreateAppointment(filteredDocks[0]?.id || 1)}>
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
            <DoorBoard 
              docks={filteredDocks} 
              schedules={schedules} 
              carriers={carriers}
              onCreateAppointment={handleCreateAppointment}
            />
          </TabsContent>
          
          <TabsContent value="timeline" className="m-0">
            <div className="flex items-center justify-center p-8 bg-gray-50 rounded-md">
              <div className="flex flex-col items-center gap-2 text-gray-500">
                <Calendar className="h-12 w-12" />
                <p>Timeline view coming soon</p>
                <Button variant="outline" size="sm">
                  Switch to Board View
                </Button>
              </div>
            </div>
          </TabsContent>
        </CardContent>
      </Card>
      
      {/* Door Appointment Form Dialog */}
      {showAppointmentForm && selectedDockId && selectedTimeSlot && (
        <DoorAppointmentForm 
          isOpen={showAppointmentForm}
          onClose={handleCloseAppointmentForm}
          dockId={selectedDockId}
          initialStartTime={selectedTimeSlot.start}
          initialEndTime={selectedTimeSlot.end}
          carriers={carriers}
          onSuccess={() => {
            refetchSchedules();
            handleCloseAppointmentForm();
          }}
        />
      )}
    </div>
  );
}