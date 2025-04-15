import { cn } from "@/lib/utils";
import { IconBadge } from "@/components/ui/icon-badge";
import { TruckIcon } from "lucide-react";

interface ArrivalCardProps {
  arrival: {
    id: number;
    truckNumber: string;
    carrier: string;
    time: string;
    type: "inbound" | "outbound";
    door: string;
    status: "on-time" | "delayed" | "possible-delay";
    eta: string; 
  };
}

export default function ArrivalCard({ arrival }: ArrivalCardProps) {
  // Status badge styling
  const statusStyles = {
    "on-time": "bg-green-500 bg-opacity-10 text-green-500",
    "delayed": "bg-red-500 bg-opacity-10 text-red-500",
    "possible-delay": "bg-yellow-500 bg-opacity-10 text-yellow-500",
  };
  
  const statusLabels = {
    "on-time": "On Time",
    "delayed": "Delayed",
    "possible-delay": "Possible Delay",
  };

  return (
    <div className="flex border-b border-neutral-200 pb-4 last:border-0 last:pb-0">
      <IconBadge icon={TruckIcon} variant="primary" size="lg" />
      <div className="flex-grow ml-4">
        <div className="flex justify-between">
          <div className="font-medium">{arrival.carrier} #{arrival.truckNumber}</div>
          <div className="text-xs text-neutral-400">{arrival.time}</div>
        </div>
        <div className="text-sm text-neutral-400 mt-1">
          {arrival.type === "inbound" ? "Inbound" : "Outbound"} • Door Reserved: {arrival.door}
        </div>
        <div className="flex items-center mt-2">
          <span className={cn("px-2 py-1 text-xs rounded-md mr-2", statusStyles[arrival.status])}>
            {statusLabels[arrival.status]}
          </span>
          <span className="text-xs text-neutral-400">
            {arrival.status === "delayed" ? `New ETA: ${arrival.eta}` : `ETA: ${arrival.eta}`}
          </span>
        </div>
      </div>
    </div>
  );
}
