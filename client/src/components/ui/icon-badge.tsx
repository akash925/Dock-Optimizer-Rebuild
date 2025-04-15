import React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface IconBadgeProps {
  icon: LucideIcon;
  variant?: "default" | "primary" | "secondary" | "success" | "warning" | "danger";
  size?: "sm" | "md" | "lg";
}

const variantStyles = {
  default: "bg-neutral-100 text-neutral-500",
  primary: "bg-primary/10 text-primary",
  secondary: "bg-green-600/10 text-green-600",
  success: "bg-green-500/10 text-green-500",
  warning: "bg-yellow-500/10 text-yellow-500",
  danger: "bg-red-500/10 text-red-500",
};

const sizeStyles = {
  sm: "w-8 h-8 rounded-md",
  md: "w-10 h-10 rounded-md",
  lg: "w-12 h-12 rounded-full",
};

const iconSizeStyles = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
};

export const IconBadge = ({
  icon: Icon,
  variant = "default",
  size = "md",
}: IconBadgeProps) => {
  return (
    <div
      className={cn(
        "flex items-center justify-center",
        variantStyles[variant],
        sizeStyles[size]
      )}
    >
      <Icon className={cn(iconSizeStyles[size])} />
    </div>
  );
};
