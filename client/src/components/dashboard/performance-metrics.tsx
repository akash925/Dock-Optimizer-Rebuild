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
  
  // Simulate data loading with different period
  useEffect(() => {
    // In real app, this would fetch data from backend based on selected period
    const generateRandomVariation = (baseValue: number, range: number) => {
      return Math.max(0, Math.min(100, baseValue + (Math.random() * range * 2) - range));
    };
    
    if (period === "last7Days") {
      setMetrics({
        dockUtilization: 78,
        onTimeArrivals: 92,
        avgTurnaround: 42,
        dwellTimeAccuracy: 81
      });
    } else if (period === "last30Days") {
      setMetrics({
        dockUtilization: Math.round(generateRandomVariation(78, 5)),
        onTimeArrivals: Math.round(generateRandomVariation(92, 3)),
        avgTurnaround: Math.round(generateRandomVariation(42, 4)),
        dwellTimeAccuracy: Math.round(generateRandomVariation(81, 6))
      });
    } else if (period === "lastQuarter") {
      setMetrics({
        dockUtilization: Math.round(generateRandomVariation(78, 7)),
        onTimeArrivals: Math.round(generateRandomVariation(92, 5)),
        avgTurnaround: Math.round(generateRandomVariation(42, 6)),
        dwellTimeAccuracy: Math.round(generateRandomVariation(81, 8))
      });
    } else if (period === "ytd") {
      setMetrics({
        dockUtilization: Math.round(generateRandomVariation(78, 10)),
        onTimeArrivals: Math.round(generateRandomVariation(92, 8)),
        avgTurnaround: Math.round(generateRandomVariation(42, 8)),
        dwellTimeAccuracy: Math.round(generateRandomVariation(81, 10))
      });
    }
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
                onValueChange={(value) => {
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
