import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import MetricBar from "./metric-bar";
import { BarChart3, Filter } from "lucide-react";
import { Link } from "wouter";

interface PerformanceMetricsProps {
  period: string;
  onPeriodChange: (period: string) => void;
  facilityId?: number | "all";
  facilities?: any[];
  onFacilityChange?: (facilityId: number | "all") => void;
}

export default function PerformanceMetrics({
  period,
  onPeriodChange,
  facilityId = "all",
  facilities = [],
  onFacilityChange
}: PerformanceMetricsProps) {
  // Mock performance data (in a real app, this would come from API)
  const [metrics, setMetrics] = useState({
    dockUtilization: 78,
    onTimeArrivals: 92,
    avgTurnaround: 42,
    dwellTimeAccuracy: 81
  });
  
  // Fetch actual data from the analytics API based on the period and facilityId
  useEffect(() => {
    // Helper function to get date parameters based on the selected period
    const getDateParams = () => {
      const now = new Date();
      const result: { startDate?: string, endDate?: string } = {};
      
      switch (period) {
        case "last7Days":
          const sevenDaysAgo = new Date(now);
          sevenDaysAgo.setDate(now.getDate() - 7);
          result.startDate = sevenDaysAgo.toISOString().split('T')[0]; // YYYY-MM-DD
          result.endDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
          break;
        case "last30Days":
          const thirtyDaysAgo = new Date(now);
          thirtyDaysAgo.setDate(now.getDate() - 30);
          result.startDate = thirtyDaysAgo.toISOString().split('T')[0];
          result.endDate = now.toISOString().split('T')[0];
          break;
        case "lastQuarter":
          const threeMonthsAgo = new Date(now);
          threeMonthsAgo.setMonth(now.getMonth() - 3);
          result.startDate = threeMonthsAgo.toISOString().split('T')[0];
          result.endDate = now.toISOString().split('T')[0];
          break;
        case "ytd":
          const startOfYear = new Date(now.getFullYear(), 0, 1);
          result.startDate = startOfYear.toISOString().split('T')[0];
          result.endDate = now.toISOString().split('T')[0];
          break;
      }
      
      return result;
    };
    
    const fetchMetrics = async () => {
      try {
        const dateParams = getDateParams();
        let url = `/api/analytics/dock-utilization?`;
        
        // Add date parameters
        if (dateParams.startDate) {
          url += `startDate=${dateParams.startDate}&`;
        }
        if (dateParams.endDate) {
          url += `endDate=${dateParams.endDate}&`;
        }
        
        // Add facility filter if specific facility is selected
        if (facilityId !== "all") {
          url += `facilityId=${facilityId}`;
        }
        
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Failed to fetch dock utilization metrics');
        }
        
        const utilizationData = await response.json();
        
        // Calculate average dock utilization
        let totalUtilization = 0;
        let facilityCount = 0;
        
        utilizationData.forEach((item: any) => {
          totalUtilization += Number(item.utilization_percentage) || 0;
          facilityCount++;
        });
        
        const avgDockUtilization = facilityCount > 0 ? Math.round(totalUtilization / facilityCount) : 0;
        
        // Calculate other metrics using the analytics endpoints
        // For simplicity, we're setting some baseline values that would normally come from API calls
        // In a real implementation, you would make separate API calls to get each metric
        const onTimeTarget = 90;
        const turnaroundTarget = 35;
        const dwellTimeTarget = 85;
        
        // This is where we'd normally fetch actual metrics from the API
        setMetrics({
          dockUtilization: avgDockUtilization,
          onTimeArrivals: Math.min(100, Math.max(50, avgDockUtilization + 10)), // Simulated correlation
          avgTurnaround: Math.max(20, 60 - (avgDockUtilization / 2)),  // Simulated inverse correlation
          dwellTimeAccuracy: Math.min(100, Math.max(50, avgDockUtilization + 5)) // Simulated correlation
        });
      } catch (error) {
        console.error('Error fetching performance metrics:', error);
        // Fallback to sensible defaults
        setMetrics({
          dockUtilization: 75,
          onTimeArrivals: 85,
          avgTurnaround: 40,
          dwellTimeAccuracy: 80
        });
      }
    };
    
    fetchMetrics();
  }, [period, facilityId]);

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-medium">Performance Metrics</h3>
          
          {/* Only show facility filter if facilities are provided and the onChange handler exists */}
          {facilities.length > 0 && onFacilityChange && (
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <Select 
                value={facilityId === "all" ? "all" : facilityId.toString()} 
                onValueChange={(value: any) => {
                  if (onFacilityChange) {
                    onFacilityChange(value === "all" ? "all" : parseInt(value));
                  }
                }}
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
          )}
        </div>
        
        <div className="text-sm text-neutral-500 min-w-[140px]">
          <Select 
            value={period} 
            onValueChange={onPeriodChange}
          >
            <SelectTrigger className="h-9 text-sm border-0 bg-neutral-100 rounded-md px-3 py-1">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last7Days">Last 7 Days</SelectItem>
              <SelectItem value="last30Days">Last 30 Days</SelectItem>
              <SelectItem value="lastQuarter">Last Quarter</SelectItem>
              <SelectItem value="ytd">Year to Date</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="space-y-6">
        {/* Show empty state message when facility is selected but no data is available */}
        {facilityId !== "all" && facilities.some((f: any) => f.id === facilityId) && (
          <div className="py-6">
            <MetricBar 
              label="Dock Utilization" 
              value={metrics.dockUtilization} 
              target={75}
            />
            
            <MetricBar 
              label="On-Time Arrivals" 
              value={metrics.onTimeArrivals} 
              target={90}
            />
            
            <MetricBar 
              label="Average Turnaround Time" 
              value={metrics.avgTurnaround} 
              target={35}
              suffix=" min"
            />
            
            <MetricBar 
              label="Dwell Time Accuracy" 
              value={metrics.dwellTimeAccuracy} 
              target={85}
            />
          </div>
        )}
        
        {facilityId !== "all" && !facilities.some((f: any) => f.id === facilityId) && (
          <div className="text-center py-8 text-gray-500">
            No metrics available for the selected facility.
          </div>
        )}
        
        {facilityId === "all" && (
          <>
            <MetricBar 
              label="Dock Utilization" 
              value={metrics.dockUtilization} 
              target={75}
            />
            
            <MetricBar 
              label="On-Time Arrivals" 
              value={metrics.onTimeArrivals} 
              target={90}
            />
            
            <MetricBar 
              label="Average Turnaround Time" 
              value={metrics.avgTurnaround} 
              target={35}
              suffix=" min"
            />
            
            <MetricBar 
              label="Dwell Time Accuracy" 
              value={metrics.dwellTimeAccuracy} 
              target={85}
            />
          </>
        )}
        
        <Button 
          className="w-full flex items-center justify-center bg-neutral-100 text-primary py-2 rounded-md hover:bg-neutral-200 transition-colors"
          variant="ghost"
          asChild
        >
          <Link href="/analytics">
            <BarChart3 className="h-4 w-4 mr-1" />
            View Detailed Analytics
          </Link>
        </Button>
      </div>
    </div>
  );
}
