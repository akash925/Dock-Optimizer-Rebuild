import { useState, useEffect } from "react";
import { format, formatInTimeZone } from "date-fns-tz";
import { formatToTimeZone } from "date-fns-timezone";

// Function to get user's timezone
const getUserTimeZoneFromBrowser = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
  } catch (error) {
    console.error("Error detecting timezone:", error);
    return "America/New_York";
  }
};

export function useTimeZoneUtils() {
  const [userTimezone, setUserTimezone] = useState<string>("America/New_York");
  
  useEffect(() => {
    // Try to get user's timezone from browser
    const detectedTimezone = getUserTimeZoneFromBrowser();
    setUserTimezone(detectedTimezone);
  }, []);
  
  // Allow components to get the current user timezone
  const getUserTimeZone = (): string => {
    return userTimezone;
  };
  
  // Get timezone abbreviation (e.g., EST, PDT)
  const getTzAbbreviation = (timezone?: string) => {
    const targetTimezone = timezone || userTimezone;
    
    try {
      // Get the abbreviated timezone string, e.g., "EDT" or "PST"
      const now = new Date();
      const tzAbbr = now.toLocaleString('en-US', {
        timeZone: targetTimezone,
        timeZoneName: 'short'
      }).split(' ').pop();
      
      // Extract just the timezone abbreviation from the string
      const match = tzAbbr?.match(/[A-Z]{3,4}/);
      return match ? match[0] : tzAbbr;
    } catch (error) {
      console.error("Error getting timezone abbreviation:", error);
      return targetTimezone.split('/').pop();
    }
  };
  
  // Format a date to the user's timezone
  const formatDateInUserTimezone = (date: Date | string, formatString: string = "MMM d, yyyy") => {
    if (!date) return "";
    
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return format(dateObj, formatString, { timeZone: userTimezone });
    } catch (error) {
      console.error("Error formatting date in user timezone:", error);
      return "";
    }
  };
  
  // Format a time to the user's timezone
  const formatTimeInUserTimezone = (time: Date | string, facilityTimezone?: string) => {
    if (!time) return "";
    
    try {
      const timeObj = typeof time === 'string' ? new Date(time) : time;
      const targetTz = facilityTimezone || userTimezone;
      
      // First convert to facility timezone if provided
      let formattedTime = timeObj;
      if (facilityTimezone) {
        formattedTime = new Date(format(timeObj, "yyyy-MM-dd'T'HH:mm:ss", { 
          timeZone: facilityTimezone 
        }));
      }
      
      // Then format in user's timezone
      return format(formattedTime, "h:mm a", { timeZone: userTimezone });
    } catch (error) {
      console.error("Error formatting time in user timezone:", error);
      return "";
    }
  };
  
  // Format a time range in both facility and user timezones
  const formatTimeRangeForDualZones = (
    startTime: Date | string,
    endTime: Date | string,
    facilityTimezone?: string
  ) => {
    if (!startTime || !endTime) {
      return {
        facilityTimeRange: "Not scheduled",
        userTimeRange: "Not scheduled",
        facilityZoneAbbr: "",
        userZoneAbbr: "",
      };
    }
    
    try {
      const startObj = typeof startTime === 'string' ? new Date(startTime) : startTime;
      const endObj = typeof endTime === 'string' ? new Date(endTime) : endTime;
      const targetFacilityTz = facilityTimezone || "America/New_York";
      
      // Format facility time
      const facilityStart = formatInTimeZone(startObj, targetFacilityTz, "h:mm a");
      const facilityEnd = formatInTimeZone(endObj, targetFacilityTz, "h:mm a");
      const facilityTimeRange = `${facilityStart} - ${facilityEnd}`;
      
      // Format user local time
      const userStart = format(startObj, "h:mm a", { timeZone: userTimezone });
      const userEnd = format(endObj, "h:mm a", { timeZone: userTimezone });
      const userTimeRange = `${userStart} - ${userEnd}`;
      
      // Get timezone abbreviations
      const facilityZoneAbbr = getTzAbbreviation(targetFacilityTz);
      const userZoneAbbr = getTzAbbreviation();
      
      return {
        facilityTimeRange,
        userTimeRange,
        facilityZoneAbbr,
        userZoneAbbr,
      };
    } catch (error) {
      console.error("Error formatting time range for dual zones:", error);
      return {
        facilityTimeRange: "Error formatting time",
        userTimeRange: "Error formatting time",
        facilityZoneAbbr: "",
        userZoneAbbr: "",
      };
    }
  };
  
  return {
    userTimezone,
    getTzAbbreviation,
    formatDateInUserTimezone,
    formatTimeInUserTimezone,
    formatTimeRangeForDualZones,
  };
}