import { Link } from "wouter";
import { formatDuration } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { useEffect, useState } from "react";

interface DockStatusItem {
  id: number;
  name: string;
  status: "available" | "occupied" | "reserved" | "maintenance";
  currentSchedule?: any;
  carrier?: string;
  elapsedTime?: number;
  remainingTime?: number;
}

interface DockGridProps {
  dockStatuses: DockStatusItem[];
}

export default function DockGrid({ dockStatuses }: DockGridProps) {
  const [timeUpdate, setTimeUpdate] = useState(new Date());
  
  // Update time every 30 seconds to refresh timers
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeUpdate(new Date());
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Get status color class
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {dockStatuses.map((dock) => (
        <Link key={dock.id} href={`/dock-status/${dock.id}`}>
          <div className="border rounded-md p-4 h-full hover:border-primary hover:shadow-sm transition-all cursor-pointer">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-medium text-lg">{dock.name}</h3>
              <Badge variant={getStatusBadgeVariant(dock.status)}>
                <span className={`h-2 w-2 rounded-full ${getStatusColor(dock.status)} mr-1.5`}></span>
                <span className="capitalize">{dock.status}</span>
              </Badge>
            </div>
            
            {dock.status === "occupied" && dock.carrier && (
              <div className="mb-3">
                <p className="text-sm font-medium">{dock.carrier}</p>
                <div className="flex items-center text-xs text-gray-500 mt-1">
                  <Clock className="h-3 w-3 mr-1" />
                  <span>
                    Elapsed: {dock.elapsedTime ? formatDuration(dock.elapsedTime) : "--:--:--"}
                  </span>
                </div>
                {dock.remainingTime && (
                  <div className="text-xs text-gray-500 mt-1 ml-4">
                    Remaining: {formatDuration(dock.remainingTime)}
                  </div>
                )}
              </div>
            )}
            
            {dock.status === "reserved" && dock.carrier && (
              <div className="mb-3">
                <p className="text-sm font-medium">Reserved for: {dock.carrier}</p>
                {dock.currentSchedule && (
                  <div className="text-xs text-gray-500 mt-1">
                    Scheduled: {new Date(dock.currentSchedule.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>
            )}
            
            {dock.status === "available" && (
              <div className="mb-3">
                <p className="text-sm text-gray-500">No active schedules</p>
              </div>
            )}
            
            {dock.status === "maintenance" && (
              <div className="mb-3">
                <p className="text-sm text-gray-500">Under maintenance</p>
              </div>
            )}
            
            <div className="mt-auto pt-2 text-xs text-right text-gray-400">
              Last updated: {timeUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
