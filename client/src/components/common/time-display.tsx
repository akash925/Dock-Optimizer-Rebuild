import React from 'react';
import { formatInFacilityTimeZone, getTimeZoneAbbreviation } from '@/lib/date-utils';
import { useTimeZoneUtils } from '@/hooks/use-timezone-utils';
import { DEFAULT_TIMEZONE } from '@/lib/constants';

interface TimeDisplayProps {
  startTime: Date | string;
  endTime?: Date | string;
  facilityTimezone?: string;
  format?: '12h' | '24h';
  showUserTime?: boolean;
  showDate?: boolean;
  className?: string;
  compact?: boolean;
}

/**
 * Reusable component for displaying appointment times with proper timezone handling
 * Reduces duplication of timezone formatting logic across the app
 */
export function TimeDisplay({
  startTime,
  endTime,
  facilityTimezone = DEFAULT_TIMEZONE,
  format = '12h',
  showUserTime = true,
  showDate = false,
  className = '',
  compact = false
}: TimeDisplayProps) {
  const { getUserTimeZone, getTzAbbreviation } = useTimeZoneUtils();
  const userTimezone = getUserTimeZone();
  
  if (!startTime) {
    return <span className={className}>Time not scheduled</span>;
  }

  const startDate = typeof startTime === 'string' ? new Date(startTime) : startTime;
  const endDate = endTime ? (typeof endTime === 'string' ? new Date(endTime) : endTime) : null;
  
  // Format strings based on preferences
  const dateFormat = showDate ? (format === '24h' ? 'MM/dd/yyyy HH:mm' : 'MM/dd/yyyy h:mm a') : (format === '24h' ? 'HH:mm' : 'h:mm a');
  
  // Format facility time
  const facilityStartTime = formatInFacilityTimeZone(startDate.toISOString(), facilityTimezone);
  const facilityEndTime = endDate ? formatInFacilityTimeZone(endDate.toISOString(), facilityTimezone) : '';
  const facilityTzAbbr = getTzAbbreviation(facilityTimezone);
  
  // Format user time if requested and different from facility
  const shouldShowUserTime = showUserTime && userTimezone !== facilityTimezone;
  const userStartTime = shouldShowUserTime ? startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: userTimezone }) : '';
  const userEndTime = shouldShowUserTime && endDate ? endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: userTimezone }) : '';
  const userTzAbbr = shouldShowUserTime ? getTzAbbreviation(userTimezone) : '';

  const facilityTimeRange = facilityEndTime 
    ? `${facilityStartTime} - ${facilityEndTime} ${facilityTzAbbr}`
    : `${facilityStartTime} ${facilityTzAbbr}`;

  const userTimeRange = shouldShowUserTime && userEndTime
    ? `${userStartTime} - ${userEndTime} ${userTzAbbr}`
    : shouldShowUserTime 
      ? `${userStartTime} ${userTzAbbr}`
      : '';

  if (compact) {
    return (
      <div className={className}>
        <div className="font-medium">{facilityTimeRange}</div>
        {shouldShowUserTime && (
          <div className="text-xs text-muted-foreground italic">
            {userTimeRange} (local)
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">Facility Time:</span>
          <span>{facilityTimeRange}</span>
        </div>
        {shouldShowUserTime && (
          <div className="flex items-center gap-2">
            <span className="font-medium">Your Time:</span>
            <span>{userTimeRange}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Simplified time display for use in cards and compact layouts
 */
export function CompactTimeDisplay({
  startTime,
  endTime,
  facilityTimezone = DEFAULT_TIMEZONE,
  format = '12h',
  className = ''
}: Omit<TimeDisplayProps, 'showUserTime' | 'showDate' | 'compact'>) {
  return (
    <TimeDisplay
      startTime={startTime}
      endTime={endTime}
      facilityTimezone={facilityTimezone}
      format={format}
      showUserTime={false}
      showDate={false}
      compact={true}
      className={className}
    />
  );
}

/**
 * Full time display with both facility and user times
 */
export function FullTimeDisplay({
  startTime,
  endTime,
  facilityTimezone = DEFAULT_TIMEZONE,
  format = '12h',
  showDate = true,
  className = ''
}: Omit<TimeDisplayProps, 'showUserTime' | 'compact'>) {
  return (
    <TimeDisplay
      startTime={startTime}
      endTime={endTime}
      facilityTimezone={facilityTimezone}
      format={format}
      showUserTime={true}
      showDate={showDate}
      compact={false}
      className={className}
    />
  );
} 