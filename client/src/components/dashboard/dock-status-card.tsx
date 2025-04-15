import { useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn, getStatusColor, formatDuration } from "@/lib/utils";
import { Link } from "wouter";

interface DockStatusCardProps {
  dock: {
    id: number;
    name: string;
    status: "available" | "occupied" | "reserved" | "maintenance";
  };
  nextInfo?: {
    carrier: string;
    time: string;
    id?: number;
  };
  currentInfo?: {
    carrier: string;
    startTime: string;
    id?: number;
  };
}

export default function DockStatusCard({
  dock,
  nextInfo,
  currentInfo,
}: DockStatusCardProps) {
  const [durationMs, setDurationMs] = useState<number>(0);

  // Update the duration in real time for occupied docks
  useEffect(() => {
    if (dock.status !== "occupied" || !currentInfo) return;
    
    const startTime = new Date(currentInfo.startTime).getTime();
    
    const updateDuration = () => {
      const now = new Date().getTime();
      setDurationMs(now - startTime);
    };
    
    updateDuration();
    const interval = setInterval(updateDuration, 1000);
    
    return () => clearInterval(interval);
  }, [dock.status, currentInfo]);

  return (
    <div className="border border-neutral-200 rounded-md p-3 flex justify-between">
      <div>
        <div className="font-medium">{dock.name}</div>
        <div className="mt-1 text-sm text-neutral-400">
          <span className={cn("inline-block w-3 h-3 rounded-full mr-1", getStatusColor(dock.status))}></span>
          <span className="capitalize">{dock.status}</span>
        </div>
        <div className="mt-2 text-xs text-neutral-400">
          {dock.status === "occupied" && currentInfo && (
            <>
              <span className="font-medium text-neutral-500">{currentInfo.carrier}</span> • 
              <span> Since {new Date(currentInfo.startTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
            </>
          )}
          {dock.status === "reserved" && nextInfo && (
            <>
              <span className="font-medium text-neutral-500">{nextInfo.carrier}</span> • 
              <span> {nextInfo.time}</span>
            </>
          )}
          {dock.status === "available" && nextInfo && (
            <>
              <span className="font-medium text-neutral-500">Next: {nextInfo.carrier}</span> • 
              <span> {nextInfo.time}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end">
        {dock.status === "occupied" && (
          <div className="text-xs font-mono bg-neutral-100 px-2 py-1 rounded">
            {formatDuration(durationMs)}
          </div>
        )}
        {dock.status === "available" && nextInfo && (
          <div className="text-xs font-mono bg-neutral-100 px-2 py-1 rounded">
            {nextInfo.time}
          </div>
        )}
        {dock.status === "reserved" && (
          <div className="text-xs font-mono bg-neutral-100 px-2 py-1 rounded">
            {nextInfo?.time}
          </div>
        )}
        
        <div className="mt-auto">
          <Link
            href={`/dock-status/${dock.id}`}
            className={cn(
              buttonVariants({ variant: "link", size: "sm" }),
              "p-0 h-auto text-primary text-sm"
            )}
          >
            Details
          </Link>
        </div>
      </div>
    </div>
  );
}
