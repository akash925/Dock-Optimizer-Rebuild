import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string, options: Intl.DateTimeFormatOptions = {}): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  });
}

export function formatTime(date: Date | string, options: Intl.DateTimeFormatOptions = {}): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    ...options,
  });
}

export function formatDateTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return `${formatDate(dateObj)} at ${formatTime(dateObj)}`;
}

export function getDockStatus(dockId: number, schedules: any[]): "available" | "occupied" | "reserved" {
  const now = new Date();
  
  // Check if any schedule is currently active for this dock
  const activeSchedule = schedules.find(schedule => 
    schedule.dockId === dockId && 
    new Date(schedule.startTime) <= now && 
    new Date(schedule.endTime) >= now
  );
  
  if (activeSchedule) {
    return "occupied";
  }
  
  // Check if there's an upcoming schedule within the next hour
  const upcomingSchedule = schedules.find(schedule => 
    schedule.dockId === dockId && 
    new Date(schedule.startTime) > now && 
    new Date(schedule.startTime) <= new Date(now.getTime() + 60 * 60 * 1000)
  );
  
  if (upcomingSchedule) {
    return "reserved";
  }
  
  return "available";
}

export function getStatusColor(status: "available" | "occupied" | "reserved" | "maintenance") {
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
}

export function getTimeDifference(date: Date | string): string {
  const now = new Date();
  const targetDate = typeof date === 'string' ? new Date(date) : date;
  const differenceMs = targetDate.getTime() - now.getTime();
  
  // For past dates
  if (differenceMs < 0) {
    const mins = Math.round(Math.abs(differenceMs) / 1000 / 60);
    if (mins < 60) return `${mins}m ago`;
    
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
  
  // For future dates
  const mins = Math.round(differenceMs / 1000 / 60);
  if (mins < 60) return `in ${mins}m`;
  
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `in ${hours}h`;
  
  const days = Math.floor(hours / 24);
  return `in ${days}d`;
}

export function formatDuration(durationMs: number): string {
  const totalSeconds = Math.floor(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function calculateDuration(startTime: Date | string, endTime: Date | string): number {
  const start = typeof startTime === 'string' ? new Date(startTime) : startTime;
  const end = typeof endTime === 'string' ? new Date(endTime) : endTime;
  return end.getTime() - start.getTime();
}

// Array of week days for availability settings
export const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
