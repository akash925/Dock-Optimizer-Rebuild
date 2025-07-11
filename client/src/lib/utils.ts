import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | null | undefined, options: Intl.DateTimeFormatOptions = {}): string {
  if (!date) return "N/A";
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return "Invalid Date";
    
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...options,
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return "Invalid Date";
  }
}

export function formatTime(date: Date | string | null | undefined, options: Intl.DateTimeFormatOptions = {}): string {
  if (!date) return "N/A";
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return "Invalid Time";
    
    return dateObj.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      ...options,
    });
  } catch (error) {
    console.error('Error formatting time:', error);
    return "Invalid Time";
  }
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "N/A";
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return "Invalid DateTime";
    
    return `${formatDate(dateObj)} at ${formatTime(dateObj)}`;
  } catch (error) {
    console.error('Error formatting datetime:', error);
    return "Invalid DateTime";
  }
}

export function getDockStatus(dockId: number, schedules: any[]): "available" | "occupied" | "reserved" {
  const now = new Date();
  
  // Debug logging to identify field mapping issues
  const dockSchedules = schedules.filter(schedule => {
    // Handle both dockId and dock_id field naming
    const scheduleDockId = schedule.dockId || schedule.dock_id;
    return scheduleDockId === dockId;
  });
  
  console.log(`[DockStatus] Checking dock ${dockId}, found ${dockSchedules.length} schedules:`, 
    dockSchedules.map(s => ({
      id: s.id,
      dockId: s.dockId || s.dock_id,
      start: s.startTime || s.start_time,
      end: s.endTime || s.end_time,
      status: s.status
    }))
  );
  
  // Check if any schedule is currently active for this dock
  const activeSchedule = schedules.find(schedule => {
    const scheduleDockId = schedule.dockId || schedule.dock_id;
    const startTime = schedule.startTime || schedule.start_time;
    const endTime = schedule.endTime || schedule.end_time;
    
    return scheduleDockId === dockId && 
      new Date(startTime) <= now && 
      new Date(endTime) >= now &&
      schedule.status !== "completed" &&
      schedule.status !== "cancelled";
  });
  
  if (activeSchedule) {
    console.log(`[DockStatus] Dock ${dockId} is OCCUPIED by schedule:`, activeSchedule);
    return "occupied";
  }
  
  // Check if there's an upcoming schedule within the next hour
  const upcomingSchedule = schedules.find(schedule => {
    const scheduleDockId = schedule.dockId || schedule.dock_id;
    const startTime = schedule.startTime || schedule.start_time;
    
    return scheduleDockId === dockId && 
      new Date(startTime) > now && 
      new Date(startTime) <= new Date(now.getTime() + 60 * 60 * 1000) &&
      schedule.status !== "completed" &&
      schedule.status !== "cancelled";
  });
  
  if (upcomingSchedule) {
    console.log(`[DockStatus] Dock ${dockId} is RESERVED by upcoming schedule:`, upcomingSchedule);
    return "reserved";
  }
  
  console.log(`[DockStatus] Dock ${dockId} is AVAILABLE`);
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


export function safeToString(value: any): string | undefined {
  if (value === null || value === undefined || Number.isNaN(value)) return undefined;
  return String(value);
}


export function calculateDuration(startTime: Date | string, endTime: Date | string): number {
  const start = typeof startTime === 'string' ? new Date(startTime) : startTime;
  const end = typeof endTime === 'string' ? new Date(endTime) : endTime;
  return end.getTime() - start.getTime();
}

// Array of week days for availability settings
export const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
