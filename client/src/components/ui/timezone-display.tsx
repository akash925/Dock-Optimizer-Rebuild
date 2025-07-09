import { Clock } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { getUserTimeZone, getTimeZoneAbbreviation } from "@/lib/timezone-utils";

interface TimezoneDisplayProps {
  startTime: Date | string;
  endTime?: Date | string;
  facilityTimezone: string;
  showUserTime?: boolean;
  format?: "short" | "full";
  className?: string;
}

export function TimezoneDisplay({
  startTime,
  endTime,
  facilityTimezone,
  showUserTime = true,
  format = "short",
  className = ""
}: TimezoneDisplayProps) {
  const userTimezone = getUserTimeZone();
  const shouldShowBoth = showUserTime && userTimezone !== facilityTimezone;
  
  const startDate = typeof startTime === 'string' ? new Date(startTime) : startTime;
  const endDate = endTime ? (typeof endTime === 'string' ? new Date(endTime) : endTime) : null;
  
  // Format facility time
  const facilityStart = formatInTimeZone(startDate, facilityTimezone, 'h:mm a');
  const facilityEnd = endDate ? formatInTimeZone(endDate, facilityTimezone, 'h:mm a') : null;
  const facilityAbbr = getTimeZoneAbbreviation(facilityTimezone);
  
  // Format user time if different
  const userStart = shouldShowBoth ? formatInTimeZone(startDate, userTimezone, 'h:mm a') : null;
  const userEnd = shouldShowBoth && endDate ? formatInTimeZone(endDate, userTimezone, 'h:mm a') : null;
  const userAbbr = shouldShowBoth ? getTimeZoneAbbreviation(userTimezone) : null;
  
  const facilityTimeRange = facilityEnd ? `${facilityStart} - ${facilityEnd}` : facilityStart;
  const userTimeRange = userEnd ? `${userStart} - ${userEnd}` : userStart;
  
  if (format === "short") {
    return (
      <div className={className}>
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span className="font-medium">{facilityTimeRange}</span>
          <span className="text-xs text-muted-foreground">({facilityAbbr})</span>
        </div>
        {shouldShowBoth && (
          <div className="text-xs text-muted-foreground ml-4">
            Your time: {userTimeRange} ({userAbbr})
          </div>
        )}
      </div>
    );
  }
  
  return (
    <div className={className}>
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Facility Time:</span>
          <span>{facilityTimeRange} {facilityAbbr}</span>
        </div>
        {shouldShowBoth && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Your Time:</span>
            <span>{userTimeRange} {userAbbr}</span>
          </div>
        )}
      </div>
    </div>
  );
} 