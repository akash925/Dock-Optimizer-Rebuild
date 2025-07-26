import { Request, Response } from 'express';
import { getStorage } from '../../storage';

export interface Holiday {
  name: string;
  date: string; // ISO format date string (YYYY-MM-DD)
  enabled: boolean;
}

/**
 * Standard US Federal Holidays by year
 * Used for auto-syncing holidays annually
 */
export const getStandardHolidays = (year: number): Holiday[] => {
  // Calculate dates for holidays that fall on specific days of the week
  // Martin Luther King Jr. Day (3rd Monday in January)
  const mlkDay = calculateNthDayOfMonth(year, 0, 1, 3); // 3rd Monday (1) of January (0)
  
  // Presidents' Day (3rd Monday in February)
  const presidentsDay = calculateNthDayOfMonth(year, 1, 1, 3); // 3rd Monday (1) of February (1)
  
  // Memorial Day (last Monday in May)
  const memorialDay = calculateLastDayOfMonth(year, 4, 1); // Last Monday (1) of May (4)
  
  // Labor Day (1st Monday in September)
  const laborDay = calculateNthDayOfMonth(year, 8, 1, 1); // 1st Monday (1) of September (8)
  
  // Columbus Day (2nd Monday in October)
  const columbusDay = calculateNthDayOfMonth(year, 9, 1, 2); // 2nd Monday (1) of October (9)
  
  // Thanksgiving (4th Thursday in November)
  const thanksgiving = calculateNthDayOfMonth(year, 10, 4, 4); // 4th Thursday (4) of November (10)
  
  // Format dates as YYYY-MM-DD strings
  const formatDate = (date: Date): string => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  
  return [
    { name: "New Year's Day", date: `${year}-01-01`, enabled: true },
    { name: "Martin Luther King Jr. Day", date: formatDate(mlkDay), enabled: true },
    { name: "Presidents' Day", date: formatDate(presidentsDay), enabled: true },
    { name: "Memorial Day", date: formatDate(memorialDay), enabled: true },
    { name: "Juneteenth", date: `${year}-06-19`, enabled: true },
    { name: "Independence Day", date: `${year}-07-04`, enabled: true },
    { name: "Labor Day", date: formatDate(laborDay), enabled: true },
    { name: "Columbus Day", date: formatDate(columbusDay), enabled: true },
    { name: "Veterans Day", date: `${year}-11-11`, enabled: true },
    { name: "Thanksgiving Day", date: formatDate(thanksgiving), enabled: true },
    { name: "Christmas Day", date: `${year}-12-25`, enabled: true },
  ];
};

/**
 * Calculate the nth occurrence of a specific day in a month
 * @param year The year
 * @param month The month (0-11)
 * @param dayOfWeek The day of the week (0=Sunday, 1=Monday, etc.)
 * @param n The occurrence (1=first, 2=second, etc.)
 */
function calculateNthDayOfMonth(year: number, month: number, dayOfWeek: number, n: number): Date {
  const date = new Date(year, month, 1);
  // Find the first occurrence of the specified day of the week
  while (date.getDay() !== dayOfWeek) {
    date.setDate(date.getDate() + 1);
  }
  // Add (n-1) weeks to get to the nth occurrence
  date.setDate(date.getDate() + (n - 1) * 7);
  return date;
}

/**
 * Calculate the last occurrence of a specific day in a month
 * @param year The year
 * @param month The month (0-11)
 * @param dayOfWeek The day of the week (0=Sunday, 1=Monday, etc.)
 */
function calculateLastDayOfMonth(year: number, month: number, dayOfWeek: number): Date {
  // Start from the last day of the month and work backward
  const date = new Date(year, month + 1, 0); // Last day of the month
  while (date.getDay() !== dayOfWeek) {
    date.setDate(date.getDate() - 1);
  }
  return date;
}

/**
 * Ensure date is in YYYY-MM-DD format (ISO string without time)
 * This avoids timezone issues with date representation
 */
function standardizeDate(dateStr: string): string {
  try {
    if (!dateStr) return '';
    
    // If already in YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    
    // Parse the date, ensuring UTC to avoid timezone offsets
    const date = new Date(dateStr);
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  } catch (e) {
    console.error('Error standardizing date:', e);
    return dateStr; // Return original if parsing fails
  }
}

/**
 * Get all holidays for an organization
 */
export async function getOrganizationHolidays(req: Request, res: Response) {
  try {
    const organizationId = Number(req.params.organizationId);
    
    if (isNaN(organizationId)) {
      return res.status(400).json({ message: 'Invalid organization ID' });
    }
    
    const storage = await getStorage();
    const organization = await storage.getTenantById(organizationId);
    
    if (!organization) {
      return res.status(404).json({ message: 'Organization not found' });
    }
    
    // Get holidays from organization metadata
    const holidays = (organization.metadata as any)?.holidays || [];
    
    res.json(holidays);
  } catch (error) {
    console.error('Error fetching organization holidays:', error);
    res.status(500).json({ message: 'Failed to fetch organization holidays' });
  }
}

/**
 * Update holidays for an organization
 */
export async function updateOrganizationHolidays(req: Request, res: Response) {
  try {
    const organizationId = Number(req.params.organizationId);
    
    if (isNaN(organizationId)) {
      return res.status(400).json({ message: 'Invalid organization ID' });
    }
    
    const { holidays } = req.body;
    
    if (!Array.isArray(holidays)) {
      return res.status(400).json({ message: 'Holidays must be an array' });
    }
    
    const storage = await getStorage();
    const organization = await storage.getTenantById(organizationId);
    
    if (!organization) {
      return res.status(404).json({ message: 'Organization not found' });
    }
    
    // Standardize date format for all holidays to avoid timezone issues
    const standardizedHolidays = holidays.map(holiday => ({
      ...holiday,
      date: standardizeDate(holiday.date)
    }));
    
    // Create or update metadata object with holidays
    const metadata = organization.metadata || {};
    (metadata as any).holidays = standardizedHolidays;
    
    // Store last sync timestamp in metadata for annual sync tracking
    (metadata as any).holidaysLastSynced = new Date().toISOString();
    
    // Update organization with new metadata
    await storage.updateTenant(organizationId, {
      metadata
    });
    
    res.json({ success: true, holidays: standardizedHolidays });
  } catch (error) {
    console.error('Error updating organization holidays:', error);
    res.status(500).json({ message: 'Failed to update organization holidays' });
  }
}

/**
 * Sync holidays with current year federal holidays
 * This endpoint automates the process of adding holidays for the current calendar year
 */
export async function syncOrganizationHolidays(req: Request, res: Response) {
  try {
    const organizationId = Number(req.params.organizationId);
    
    if (isNaN(organizationId)) {
      return res.status(400).json({ message: 'Invalid organization ID' });
    }
    
    const storage = await getStorage();
    const organization = await storage.getTenantById(organizationId);
    
    if (!organization) {
      return res.status(404).json({ message: 'Organization not found' });
    }
    
    // Get existing holidays
    const existingHolidays: Holiday[] = (organization.metadata as any)?.holidays || [];
    
    // Get the current year
    const currentYear = new Date().getFullYear();
    
    // Calculate next year
    const nextYear = currentYear + 1;
    
    // Get standard holidays for current and next year
    const standardHolidays = [
      ...getStandardHolidays(currentYear),
      ...getStandardHolidays(nextYear)
    ];
    
    // Create a map of existing holidays by date for faster lookup
    const existingHolidayDates = new Set(existingHolidays.map(h => h.date));
    
    // Merge standard holidays with existing, avoiding duplicates
    const mergedHolidays = [
      ...existingHolidays,
      ...standardHolidays.filter(h => !existingHolidayDates.has(h.date))
    ];
    
    // Create or update metadata object with merged holidays
    const metadata = organization.metadata || {};
    metadata.holidays = mergedHolidays;
    metadata.holidaysLastSynced = new Date().toISOString();
    
    // Update organization with new metadata
    await storage.updateTenant(organizationId, {
      metadata
    });
    
    res.json({ 
      success: true, 
      holidays: mergedHolidays,
      added: standardHolidays.filter(h => !existingHolidayDates.has(h.date)).length
    });
  } catch (error) {
    console.error('Error syncing organization holidays:', error);
    res.status(500).json({ message: 'Failed to sync organization holidays' });
  }
}

/**
 * Check if a given date is a holiday for an organization
 */
export async function isHoliday(organizationId: number, dateStr: string): Promise<boolean> {
  try {
    const storage = await getStorage();
    const organization = await storage.getTenantById(organizationId);
    
    if (!organization) {
      return false;
    }
    
    // Get holidays from organization metadata
    const holidays: Holiday[] = organization.metadata?.holidays || [];
    
    // Check if the date matches any enabled holiday
    return holidays.some(holiday => 
      holiday.enabled && 
      holiday.date === dateStr
    );
  } catch (error) {
    console.error('Error checking if date is a holiday:', error);
    return false;
  }
}