import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dock, Schedule, Carrier } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getDockStatus, formatDuration, getStatusColor } from "@/lib/utils";
import { Search, RefreshCw, FilePlus } from "lucide-react";
import DockGrid from "@/components/dock-status/dock-grid";
import { useToast } from "@/hooks/use-toast";

export default function DockStatus() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [lastUpdated, setLastUpdated] = useState(new Date());
  
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
  
  // Calculate dock statuses
  const [dockStatuses, setDockStatuses] = useState<Array<{
    id: number;
    name: string;
    status: "available" | "occupied" | "reserved" | "maintenance";
    currentSchedule?: Schedule;
    carrier?: string;
    elapsedTime?: number;
    remainingTime?: number;
  }>>([]);
  
  // Process dock status data
  useEffect(() => {
    if (docks.length > 0 && schedules.length > 0) {
      const now = new Date();
      
      const statuses = docks.map(dock => {
        const status = getDockStatus(dock.id, schedules);
        
        // Find current schedule for occupied docks
        const currentSchedule = schedules.find(s => 
          s.dockId === dock.id && 
          new Date(s.startTime) <= now && 
          new Date(s.endTime) >= now
        );
        
        // Calculate elapsed and remaining time for occupied docks
        let elapsedTime: number | undefined;
        let remainingTime: number | undefined;
        
        if (currentSchedule) {
          const startTime = new Date(currentSchedule.startTime);
          const endTime = new Date(currentSchedule.endTime);
          elapsedTime = now.getTime() - startTime.getTime();
          remainingTime = endTime.getTime() - now.getTime();
        }
        
        // Get carrier name
        const carrier = currentSchedule 
          ? carriers.find(c => c.id === currentSchedule.carrierId)?.name 
          : undefined;
        
        return {
          id: dock.id,
          name: dock.name,
          status: status as "available" | "occupied" | "reserved" | "maintenance",
          currentSchedule,
          carrier,
          elapsedTime,
          remainingTime
        };
      });
      
      setDockStatuses(statuses);
    }
  }, [docks, schedules, carriers, lastUpdated]);
  
  // Filter docks based on search term
  const filteredDocks = dockStatuses.filter(dock => 
    dock.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (dock.carrier && dock.carrier.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  // Group docks by area (e.g., A, B)
  const docksByArea = filteredDocks.reduce((acc, dock) => {
    const area = dock.name.split('-')[0];
    if (!acc[area]) {
      acc[area] = [];
    }
    acc[area].push(dock);
    return acc;
  }, {} as Record<string, typeof filteredDocks>);
  
  // Handle refresh
  const handleRefresh = async () => {
    await Promise.all([refetchDocks(), refetchSchedules()]);
    setLastUpdated(new Date());
    toast({
      title: "Refreshed",
      description: "Dock status has been updated.",
    });
  };
  
  // Set up auto-refresh
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdated(new Date());
    }, 60000); // Refresh every minute
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-medium">Dock Status</h2>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline">
            <FilePlus className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>
      
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between p-4">
          <CardTitle className="text-lg flex items-center gap-2">
            Dock Status
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
                placeholder="Search docks or carriers..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Tabs
              value={viewMode}
              onValueChange={(value) => setViewMode(value as "grid" | "list")}
              className="ml-2"
            >
              <TabsList>
                <TabsTrigger value="grid">Grid</TabsTrigger>
                <TabsTrigger value="list">List</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          
          <TabsContent value="grid" className="m-0">
            <DockGrid dockStatuses={filteredDocks} />
          </TabsContent>
          
          <TabsContent value="list" className="m-0">
            <div className="space-y-4">
              {Object.entries(docksByArea).map(([area, docks]) => (
                <div key={area}>
                  <h3 className="font-medium text-lg mb-2">Area {area}</h3>
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-neutral-100">
                          <th className="px-4 py-2 text-left font-medium">Dock</th>
                          <th className="px-4 py-2 text-left font-medium">Status</th>
                          <th className="px-4 py-2 text-left font-medium">Current Carrier</th>
                          <th className="px-4 py-2 text-left font-medium">Elapsed Time</th>
                          <th className="px-4 py-2 text-left font-medium">Remaining Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {docks.map((dock) => (
                          <tr key={dock.id} className="border-t">
                            <td className="px-4 py-2">{dock.name}</td>
                            <td className="px-4 py-2">
                              <div className="flex items-center">
                                <div className={`w-3 h-3 rounded-full mr-2 ${getStatusColor(dock.status)}`}></div>
                                <span className="capitalize">{dock.status}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2">{dock.carrier || "—"}</td>
                            <td className="px-4 py-2">
                              {dock.elapsedTime ? formatDuration(dock.elapsedTime) : "—"}
                            </td>
                            <td className="px-4 py-2">
                              {dock.remainingTime ? formatDuration(dock.remainingTime) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </CardContent>
      </Card>
    </div>
  );
}
