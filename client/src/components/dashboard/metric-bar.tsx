import { cn } from "@/lib/utils";

interface MetricBarProps {
  label: string;
  value: number;
  target: number;
  suffix?: string;
}

export default function MetricBar({ 
  label, 
  value, 
  target,
  suffix = "%"
}: MetricBarProps) {
  const diff = value - target;
  const percentValue = (value / target) * 75; // Use 75% as cap for visualization
  
  // Determine color based on performance vs target
  const getBarColor = () => {
    if (label.includes("Turnaround") || label.includes("Dwell")) {
      // For metrics where lower is better
      return diff <= 0 ? "bg-green-500" : "bg-red-500";
    }
    // For metrics where higher is better
    return diff >= 0 ? "bg-primary" : "bg-red-500";
  };
  
  // Format the diff (for display)
  const formatDiff = () => {
    if (label.includes("Turnaround") || label.includes("Dwell")) {
      // For metrics where lower is better
      return diff <= 0 ? diff : `+${diff}`;
    }
    // For metrics where higher is better
    return diff >= 0 ? `+${diff}` : diff;
  };
  
  // Determine trend color (for text)
  const getTrendColor = () => {
    if (label.includes("Turnaround") || label.includes("Dwell")) {
      // For metrics where lower is better
      return diff <= 0 ? "text-green-500" : "text-red-500";
    }
    // For metrics where higher is better
    return diff >= 0 ? "text-green-500" : "text-red-500";
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-sm font-medium">{value}{suffix}</div>
      </div>
      <div className="w-full bg-neutral-200 rounded-full h-2">
        <div 
          className={cn("h-2 rounded-full", getBarColor())} 
          style={{ width: `${Math.min(100, Math.max(5, percentValue))}%` }}
        ></div>
      </div>
      <div className="flex justify-between mt-1">
        <div className="text-xs text-neutral-400">Target: {target}{suffix}</div>
        <div className={cn("text-xs", getTrendColor())}>{formatDiff()}{suffix}</div>
      </div>
    </div>
  );
}
