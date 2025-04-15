import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import MetricBar from "./metric-bar";
import { BarChart3 } from "lucide-react";
import { Link } from "wouter";

interface PerformanceMetricsProps {
  period: string;
  onPeriodChange: (period: string) => void;
}

export default function PerformanceMetrics({
  period,
  onPeriodChange
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
  }, [period]);

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Performance Metrics</h3>
        <Select 
          value={period} 
          onValueChange={onPeriodChange}
          className="text-sm text-neutral-500 min-w-[140px]"
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
      
      <div className="space-y-6">
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
