import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Schedule, Dock, DockStatus, Carrier, ScheduleStatus } from "@shared/schema";
import { Button } from "@/components/ui/button";
import KPICard from "@/components/dashboard/kpi-card";
import DockStatusCard from "@/components/dashboard/dock-status-card";
import ArrivalCard from "@/components/dashboard/arrival-card";
import MetricBar from "@/components/dashboard/metric-bar";
import PerformanceMetrics from "@/components/dashboard/performance-metrics";
import { BarChart3, Calendar, ChevronRight, Clock, DoorOpen, Filter, MessageCircle, PlusCircle, TruckIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { formatTime, getDockStatus } from "@/lib/utils";

export default function Dashboard() {
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState("today");
  const [performancePeriod, setPerformancePeriod] = useState("last7Days");
  
  // Fetch docks
  const { data: docks = [] } = useQuery<Dock[]>({
    queryKey: ["/api/docks"],
  });
  
  // Fetch schedules
  const { data: schedules = [] } = useQuery<Schedule[]>({
    queryKey: ["/api/schedules"],
  });
  
  // Fetch carriers
  const { data: carriers = [] } = useQuery<Carrier[]>({
    queryKey: ["/api/carriers"],
  });
  
  // Fetch facilities
  const { data: facilities = [] } = useQuery<any[]>({
    queryKey: ["/api/facilities"],
  });
  
  // Selected facility filter - default to "all" to show all docks initially
  const [selectedFacilityId, setSelectedFacilityId] = useState<number | "all">("all");
  
  // Calculate KPI metrics
  const [kpiMetrics, setKpiMetrics] = useState({
    todayTrucks: 0,
    dockUtilization: 0,
    avgTurnaround: 0,
    onTimeArrivals: 0,
    // Add comparison metrics
    truckChange: {
      value: 0,
      trend: "neutral" as "up" | "down" | "neutral",
      text: "from yesterday"
    },
    utilizationChange: {
      value: 0,
      trend: "neutral" as "up" | "down" | "neutral",
      text: "from target"
    },
    turnaroundChange: {
      value: 0,
      trend: "neutral" as "up" | "down" | "neutral",
      text: "from target"
    },
    arrivalsChange: {
      value: 0,
      trend: "neutral" as "up" | "down" | "neutral",
      text: "from last week"
    }
  });
  
  // Calculate dock status
  const [dockStatuses, setDockStatuses] = useState<Array<{
    id: number;
    name: string;
    status: "available" | "occupied" | "reserved" | "maintenance";
    currentInfo?: { carrier: string; startTime: string; id?: number };
    nextInfo?: { carrier: string; time: string; id?: number };
  }>>([]);
  
  // Calculate upcoming arrivals
  const [upcomingArrivals, setUpcomingArrivals] = useState<Array<{
    id: number;
    truckNumber: string;
    carrier: string;
    customerName?: string; // Added customerName property
    time: string;
    type: "inbound" | "outbound";
    door: string;
    status: "on-time" | "delayed" | "possible-delay";
    eta: string;
  }>>([]);

  // Calculated date range parameters
  const getDateRangeParams = () => {
    const now = new Date();
    let start, end;
    
    switch (dateRange) {
      case "today":
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
      case "yesterday":
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
        break;
      case "thisWeek":
        // Start of current week (Sunday)
        start = new Date(now);
        start.setDate(now.getDate() - now.getDay());
        start.setHours(0, 0, 0, 0);
        
        // End of current week (Saturday)
        end = new Date(now);
        end.setDate(now.getDate() + (6 - now.getDay()));
        end.setHours(23, 59, 59, 999);
        break;
      case "thisMonth":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        break;
      default:
        // Default to today
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    }
    
    return { start, end };
  };
  
  // Process data for dashboard components
  useEffect(() => {
    console.log('[Dashboard] Data status:', { 
      docks: docks.length, 
      schedules: schedules.length, 
      carriers: carriers.length,
      facilities: facilities.length 
    });
    
    if (docks.length > 0 && carriers.length > 0) {
      // Get date range based on selected option
      const { start, end } = getDateRangeParams();
      const now = new Date();
      
      // Filter schedules for the selected date range
      const dateRangeSchedules = schedules.filter(s => {
        const scheduleDate = new Date(s.startTime);
        return scheduleDate >= start && scheduleDate <= end;
      });
      
      // Filter by facility if specific facility is selected
      const filteredSchedules = selectedFacilityId === "all"
        ? dateRangeSchedules
        : dateRangeSchedules.filter(s => {
            // Find the dock for this schedule to get its facility
            const dock = docks.find(d => d.id === s.dockId);
            return dock?.facilityId === selectedFacilityId;
          });
      
      const truckCount = filteredSchedules.length;
      
      // Filter docks by facility if a specific facility is selected
      const filteredDocks = selectedFacilityId === "all" 
        ? docks 
        : docks.filter(d => d.facilityId === selectedFacilityId);
      
      const occupiedDocks = filteredDocks.filter(d => 
        getDockStatus(d.id, schedules) === "occupied"
      ).length;
      
      const dockUtilization = filteredDocks.length > 0 
        ? Math.round((occupiedDocks / filteredDocks.length) * 100) 
        : 0;
      
      // Filter completed schedules
      const completedSchedules = filteredSchedules.filter(s => s.status === "completed");
      
      const totalTurnaround = completedSchedules.reduce((acc, schedule) => {
        const start = new Date(schedule.startTime);
        const end = new Date(schedule.endTime);
        return acc + (end.getTime() - start.getTime()) / (1000 * 60); // in minutes
      }, 0);
      
      const avgTurnaround = completedSchedules.length > 0 
        ? Math.round(totalTurnaround / completedSchedules.length) 
        : 0;
      
      const onTimeSchedules = filteredSchedules.filter(s => 
        new Date(s.startTime) >= now || s.status === "completed"
      ).length;
      
      const onTimeArrivals = filteredSchedules.length > 0 
        ? Math.round((onTimeSchedules / filteredSchedules.length) * 100) 
        : 0;
      
      // Calculate comparison metrics (previous period or targets)
      // For trucks: compare with previous day/week/month depending on selection
      let prevPeriodStart: Date = new Date();
      let prevPeriodEnd: Date = new Date();
      let truckChangeText = "from yesterday";
      
      switch (dateRange) {
        case "today":
          // Compare with yesterday
          prevPeriodStart = new Date(start);
          prevPeriodStart.setDate(prevPeriodStart.getDate() - 1);
          prevPeriodEnd = new Date(end);
          prevPeriodEnd.setDate(prevPeriodEnd.getDate() - 1);
          truckChangeText = "from yesterday";
          break;
        case "yesterday":
          // Compare with 2 days ago
          prevPeriodStart = new Date(start);
          prevPeriodStart.setDate(prevPeriodStart.getDate() - 1);
          prevPeriodEnd = new Date(end);
          prevPeriodEnd.setDate(prevPeriodEnd.getDate() - 1);
          truckChangeText = "from previous day";
          break;
        case "thisWeek":
          // Compare with last week
          prevPeriodStart = new Date(start);
          prevPeriodStart.setDate(prevPeriodStart.getDate() - 7);
          prevPeriodEnd = new Date(end);
          prevPeriodEnd.setDate(prevPeriodEnd.getDate() - 7);
          truckChangeText = "from last week";
          break;
        case "thisMonth":
          // Compare with last month
          prevPeriodStart = new Date(start);
          prevPeriodStart.setMonth(prevPeriodStart.getMonth() - 1);
          prevPeriodEnd = new Date(end);
          prevPeriodEnd.setMonth(prevPeriodEnd.getMonth() - 1); // Fixed a bug: was changing date not month
          truckChangeText = "from last month";
          break;
      }
      
      // Get prev period schedules
      const prevPeriodSchedules = schedules.filter(s => {
        const scheduleDate = new Date(s.startTime);
        return scheduleDate >= prevPeriodStart && scheduleDate <= prevPeriodEnd;
      });
      
      // Filter by facility for previous period
      const filteredPrevSchedules = selectedFacilityId === "all"
        ? prevPeriodSchedules
        : prevPeriodSchedules.filter(s => {
            const dock = docks.find(d => d.id === s.dockId);
            return dock?.facilityId === selectedFacilityId;
          });
      
      const prevTruckCount = filteredPrevSchedules.length;
      
      // Calculate percent change
      let truckChange = 0;
      if (prevTruckCount > 0) {
        truckChange = Math.round(((truckCount - prevTruckCount) / prevTruckCount) * 100);
      }
      
      // Target values for comparison
      const dockUtilizationTarget = 75; // 75% utilization target
      const avgTurnaroundTarget = 35; // 35 min target
      const onTimeArrivalsTarget = 90; // 90% on-time target
      
      // Calculate difference from targets
      const utilizationDiff = dockUtilization - dockUtilizationTarget;
      const turnaroundDiff = avgTurnaround - avgTurnaroundTarget;
      const onTimeDiff = onTimeArrivals - onTimeArrivalsTarget;
      
      setKpiMetrics({
        todayTrucks: truckCount,
        dockUtilization,
        avgTurnaround,
        onTimeArrivals,
        truckChange: {
          value: Math.abs(truckChange),
          trend: truckChange > 0 ? "up" : truckChange < 0 ? "down" : "neutral",
          text: truckChangeText
        },
        utilizationChange: {
          value: Math.abs(utilizationDiff),
          trend: utilizationDiff > 0 ? "up" : utilizationDiff < 0 ? "down" : "neutral",
          text: "from target"
        },
        turnaroundChange: {
          value: Math.abs(turnaroundDiff),
          trend: turnaroundDiff < 0 ? "up" : turnaroundDiff > 0 ? "down" : "neutral", // Lower is better for turnaround
          text: "from target"
        },
        arrivalsChange: {
          value: Math.abs(onTimeDiff),
          trend: onTimeDiff > 0 ? "up" : onTimeDiff < 0 ? "down" : "neutral",
          text: "from target"
        }
      });
      
      // Calculate dock statuses
      console.log('[Dashboard] Processing', docks.length, 'docks for status calculation');
      const statuses = docks.map(dock => {
        const status = getDockStatus(dock.id, schedules);
        
        // Find current schedule for occupied docks
        const currentSchedule = schedules.find(s => 
          s.dockId === dock.id && 
          new Date(s.startTime) <= now && 
          new Date(s.endTime) >= now
        );
        
        // Find next schedule for available or reserved docks
        const nextSchedule = schedules.find(s => 
          s.dockId === dock.id && 
          new Date(s.startTime) > now
        );
        
        const currentCarrier = currentSchedule 
          ? carriers.find(c => c.id === currentSchedule.carrierId)?.name || "Unknown" 
          : undefined;
        
        const nextCarrier = nextSchedule 
          ? carriers.find(c => c.id === nextSchedule.carrierId)?.name || "Unknown" 
          : undefined;
        
        return {
          id: dock.id,
          name: dock.name,
          status: status as "available" | "occupied" | "reserved" | "maintenance",
          currentInfo: currentSchedule && currentCarrier 
            ? { 
                carrier: currentCarrier, 
                startTime: currentSchedule.startTime.toString(), // Convert to string to match the type
                id: currentSchedule.id 
              } 
            : undefined,
          nextInfo: nextSchedule && nextCarrier 
            ? { 
                carrier: nextCarrier, 
                time: formatTime(nextSchedule.startTime),
                id: nextSchedule.id 
              } 
            : undefined
        };
      });
      
      console.log('[Dashboard] Created', statuses.length, 'dock statuses');
      setDockStatuses(statuses);
      
      // Calculate upcoming arrivals
      // Filter schedules by facility if a specific facility is selected
      const facilityFilteredSchedules = selectedFacilityId === "all"
        ? schedules
        : schedules.filter(s => {
            // Find the dock for this schedule to get its facility
            const dock = docks.find(d => d.id === s.dockId);
            return dock?.facilityId === selectedFacilityId;
          });
          
      const futureSchedules = facilityFilteredSchedules
        .filter(s => new Date(s.startTime) > now)
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
        .slice(0, 4);
      
      const arrivals = futureSchedules.map(schedule => {
        const carrierName = carriers.find(c => c.id === schedule.carrierId)?.name || "Unknown";
        const dockName = docks.find(d => d.id === schedule.dockId)?.name || "Unknown";
        
        // Simulate status (in a real app this would come from data)
        let status: "on-time" | "delayed" | "possible-delay";
        if (schedule.id % 3 === 0) {
          status = "delayed";
        } else if (schedule.id % 3 === 1) {
          status = "possible-delay";
        } else {
          status = "on-time";
        }
        
        return {
          id: schedule.id,
          truckNumber: schedule.truckNumber,
          carrier: carrierName,
          customerName: schedule.customerName || undefined, // Add customer name
          time: formatTime(schedule.startTime),
          type: schedule.type as "inbound" | "outbound",
          door: dockName,
          status,
          eta: formatTime(schedule.startTime)
        };
      });
      
      setUpcomingArrivals(arrivals);
    }
  }, [docks, schedules, carriers, selectedFacilityId, dateRange]);

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-medium">Dashboard</h2>
        <div className="flex space-x-2">
          <div className="flex items-center bg-white rounded-md shadow-sm">
            <span className="text-neutral-400 px-3">
              <Calendar className="h-4 w-4" />
            </span>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="border-0 bg-transparent h-9 w-[140px]">
                <SelectValue placeholder="Select date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="thisWeek">This Week</SelectItem>
                <SelectItem value="thisMonth">This Month</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Link href="/schedules">
            <Button className="bg-primary text-white rounded-md px-4 py-2 flex items-center shadow-sm hover:bg-primary-dark transition-colors">
              <PlusCircle className="h-4 w-4 mr-1" />
              New Schedule
            </Button>
          </Link>
        </div>
      </div>
      
      {/* KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <KPICard 
          title={dateRange === "today" ? "Today's Trucks" : 
                 dateRange === "yesterday" ? "Yesterday's Trucks" : 
                 dateRange === "thisWeek" ? "This Week's Trucks" : 
                 dateRange === "thisMonth" ? "This Month's Trucks" : "Trucks"} 
          value={kpiMetrics.todayTrucks} 
          change={`${kpiMetrics.truckChange.value > 0 ? '+' : ''}${kpiMetrics.truckChange.value}% ${kpiMetrics.truckChange.text}`} 
          trend={kpiMetrics.truckChange.trend} 
          icon={TruckIcon} 
          variant="primary"
        />
        
        <KPICard 
          title="Dock Utilization" 
          value={`${kpiMetrics.dockUtilization}%`} 
          change={`${kpiMetrics.utilizationChange.value > 0 ? '+' : ''}${kpiMetrics.utilizationChange.value}% ${kpiMetrics.utilizationChange.text}`} 
          trend={kpiMetrics.utilizationChange.trend} 
          icon={DoorOpen} 
          variant="secondary"
        />
        
        <KPICard 
          title="Avg. Turnaround" 
          value={`${kpiMetrics.avgTurnaround} min`} 
          change={`${kpiMetrics.turnaroundChange.value > 0 ? '+' : ''}${kpiMetrics.turnaroundChange.value} min ${kpiMetrics.turnaroundChange.text}`}
          trend={kpiMetrics.turnaroundChange.trend} 
          icon={Clock} 
          variant="accent"
        />
        
        <KPICard 
          title="On-Time Arrivals" 
          value={`${kpiMetrics.onTimeArrivals}%`} 
          change={`${kpiMetrics.arrivalsChange.value > 0 ? '+' : ''}${kpiMetrics.arrivalsChange.value}% ${kpiMetrics.arrivalsChange.text}`}
          trend={kpiMetrics.arrivalsChange.trend} 
          icon={BarChart3} 
          variant="info"
        />
      </div>
      
      {/* Current Dock Status */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-4">
            <h3 className="text-lg font-medium">Current Dock Status</h3>
            
            {/* Facility filter */}
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <Select 
                value={selectedFacilityId === "all" ? "all" : selectedFacilityId.toString()} 
                onValueChange={(value) => setSelectedFacilityId(value === "all" ? "all" : parseInt(value))}
              >
                <SelectTrigger className="h-8 border-gray-200 text-sm font-normal w-[180px]">
                  <SelectValue placeholder="Filter by facility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Facilities</SelectItem>
                  {facilities.map((facility: any) => (
                    <SelectItem key={facility.id} value={facility.id.toString()}>
                      {facility.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <Button variant="link" asChild>
            <Link href="/door-manager" className="text-primary flex items-center text-sm">
              Door Manager
              <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {/* Debug info */}
          {process.env.NODE_ENV === 'development' && (
            <div className="col-span-full text-xs text-gray-400 mb-2">
              Debug: {dockStatuses.length} total dock statuses, 
              selected facility: {selectedFacilityId}, 
              filtered count: {dockStatuses.filter(dock => {
                if (selectedFacilityId === "all") return true;
                const fullDock = docks.find(d => d.id === dock.id);
                return fullDock?.facilityId === selectedFacilityId;
              }).length}
            </div>
          )}
          
          {dockStatuses
            .filter(dock => {
              // If "all facilities" is selected, show all docks
              if (selectedFacilityId === "all") return true;
              
              // Otherwise, find the dock in the full docks array to get its facility ID
              const fullDock = docks.find(d => d.id === dock.id);
              return fullDock?.facilityId === selectedFacilityId;
            })
            .slice(0, 8)
            .map(dock => (
              <DockStatusCard
                key={dock.id}
                dock={dock}
                currentInfo={dock.currentInfo}
                nextInfo={dock.nextInfo}
              />
            ))}
            
          {/* Show message when no docks match the selected facility */}
          {dockStatuses.filter(dock => {
            if (selectedFacilityId === "all") return true;
            const fullDock = docks.find(d => d.id === dock.id);
            return fullDock?.facilityId === selectedFacilityId;
          }).length === 0 && (
            <div className="col-span-full text-center py-8 text-gray-500">
              No dock doors found for the selected facility.
            </div>
          )}
        </div>
      </div>
      
      
      {/* Bottom Two Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Arrivals */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">Upcoming Arrivals</h3>
            <Button variant="link" asChild>
              <Link href="/schedules" className="text-primary flex items-center text-sm">
                View All
              </Link>
            </Button>
          </div>
          
          <div className="space-y-4">
            {upcomingArrivals.length > 0 ? (
              upcomingArrivals.map(arrival => (
                <ArrivalCard key={arrival.id} arrival={arrival} />
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                {selectedFacilityId === "all" 
                  ? "No upcoming arrivals scheduled."
                  : "No upcoming arrivals scheduled for the selected facility."}
              </div>
            )}
          </div>
        </div>
        
        {/* Performance Metrics */}
        <PerformanceMetrics 
          period={performancePeriod} 
          onPeriodChange={setPerformancePeriod}
          facilityId={selectedFacilityId}
          facilities={facilities}
          onFacilityChange={setSelectedFacilityId}
        />
      </div>
    </div>
  );
}
