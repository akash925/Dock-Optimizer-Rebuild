import { IconBadge } from "@/components/ui/icon-badge";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string | number;
  change?: string;
  trend?: "up" | "down" | "neutral";
  icon: LucideIcon;
  variant?: "primary" | "secondary" | "accent" | "info";
}

export default function KPICard({
  title,
  value,
  change,
  trend = "neutral",
  icon,
  variant = "primary",
}: KPICardProps) {
  // Map variants to badge variants
  const badgeVariants = {
    primary: "primary",
    secondary: "secondary",
    accent: "warning",
    info: "primary",
  } as const;
  
  // Map trend to color styling
  const trendStyles = {
    up: "text-green-500",
    down: "text-red-500",
    neutral: "text-neutral-400",
  };
  
  // Map trend to icon
  const trendIcons = {
    up: "↑",
    down: "↓",
    neutral: "→",
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex justify-between">
        <div>
          <p className="text-neutral-400 text-sm">{title}</p>
          <h3 className="text-2xl font-medium mt-1">{value}</h3>
          {change && (
            <p className={cn("text-sm flex items-center mt-2", trendStyles[trend])}>
              <span className="mr-1">{trendIcons[trend]}</span>
              {change}
            </p>
          )}
        </div>
        <IconBadge 
          icon={icon} 
          variant={badgeVariants[variant]} 
          size="lg" 
        />
      </div>
    </div>
  );
}
