import { getStorage } from "../storage";

interface HolidayRule {
  id: number;
  name: string;
  date: string;
  isActive: boolean;
  organizationId?: number;
  facilityId?: number;
}

interface OrganizationHours {
  mondayStart?: string;
  mondayEnd?: string;
  mondayOpen?: boolean;
  tuesdayStart?: string;
  tuesdayEnd?: string;
  tuesdayOpen?: boolean;
  wednesdayStart?: string;
  wednesdayEnd?: string;
  wednesdayOpen?: boolean;
  thursdayStart?: string;
  thursdayEnd?: string;
  thursdayOpen?: boolean;
  fridayStart?: string;
  fridayEnd?: string;
  fridayOpen?: boolean;
  saturdayStart?: string;
  saturdayEnd?: string;
  saturdayOpen?: boolean;
  sundayStart?: string;
  sundayEnd?: string;
  sundayOpen?: boolean;
}

interface FacilityHours extends OrganizationHours {
  overrideOrganizationHours?: boolean;
}

export class HierarchicalAvailabilityService {
  private storage: any;

  constructor() {
    this.initializeStorage();
  }

  private async initializeStorage() {
    this.storage = await getStorage();
  }

  /**
   * Get effective holidays for a facility, considering organization-level and facility-level rules
   */
  async getEffectiveHolidays(facilityId: number, organizationId: number): Promise<HolidayRule[]> {
    if (!this.storage) await this.initializeStorage();

    // Get organization-level holidays
    const orgHolidays = await this.getOrganizationHolidays(organizationId);
    
    // Get facility-level holiday overrides
    const facilityHolidays = await this.getFacilityHolidays(facilityId);

    // Merge holidays with facility overrides taking precedence
    const effectiveHolidays = new Map<string, HolidayRule>();

    // First, add all organization holidays
    orgHolidays.forEach(holiday => {
      effectiveHolidays.set(holiday.date, holiday);
    });

    // Then, override with facility-specific holidays
    facilityHolidays.forEach(holiday => {
      effectiveHolidays.set(holiday.date, holiday);
    });

    return Array.from(effectiveHolidays.values()).filter(h => h.isActive);
  }

  /**
   * Get effective operating hours for a facility, considering organization defaults and facility overrides
   */
  async getEffectiveHours(facilityId: number, organizationId: number): Promise<FacilityHours> {
    if (!this.storage) await this.initializeStorage();

    // Get organization default hours
    const organization = await this.storage.getOrganizationById(organizationId);
    const orgHours: OrganizationHours = {
      mondayStart: organization.mondayStart,
      mondayEnd: organization.mondayEnd,
      mondayOpen: organization.mondayOpen,
      tuesdayStart: organization.tuesdayStart,
      tuesdayEnd: organization.tuesdayEnd,
      tuesdayOpen: organization.tuesdayOpen,
      wednesdayStart: organization.wednesdayStart,
      wednesdayEnd: organization.wednesdayEnd,
      wednesdayOpen: organization.wednesdayOpen,
      thursdayStart: organization.thursdayStart,
      thursdayEnd: organization.thursdayEnd,
      thursdayOpen: organization.thursdayOpen,
      fridayStart: organization.fridayStart,
      fridayEnd: organization.fridayEnd,
      fridayOpen: organization.fridayOpen,
      saturdayStart: organization.saturdayStart,
      saturdayEnd: organization.saturdayEnd,
      saturdayOpen: organization.saturdayOpen,
      sundayStart: organization.sundayStart,
      sundayEnd: organization.sundayEnd,
      sundayOpen: organization.sundayOpen,
    };

    // Get facility-specific hours
    const facility = await this.storage.getFacilityById(facilityId);
    
    // If facility doesn't override organization hours, use organization defaults
    if (!facility.overrideOrganizationHours) {
      return { ...orgHours, overrideOrganizationHours: false };
    }

    // Otherwise, use facility-specific hours where defined, fallback to organization defaults
    return {
      mondayStart: facility.mondayStart || orgHours.mondayStart,
      mondayEnd: facility.mondayEnd || orgHours.mondayEnd,
      mondayOpen: facility.mondayOpen !== null ? facility.mondayOpen : orgHours.mondayOpen,
      tuesdayStart: facility.tuesdayStart || orgHours.tuesdayStart,
      tuesdayEnd: facility.tuesdayEnd || orgHours.tuesdayEnd,
      tuesdayOpen: facility.tuesdayOpen !== null ? facility.tuesdayOpen : orgHours.tuesdayOpen,
      wednesdayStart: facility.wednesdayStart || orgHours.wednesdayStart,
      wednesdayEnd: facility.wednesdayEnd || orgHours.wednesdayEnd,
      wednesdayOpen: facility.wednesdayOpen !== null ? facility.wednesdayOpen : orgHours.wednesdayOpen,
      thursdayStart: facility.thursdayStart || orgHours.thursdayStart,
      thursdayEnd: facility.thursdayEnd || orgHours.thursdayEnd,
      thursdayOpen: facility.thursdayOpen !== null ? facility.thursdayOpen : orgHours.thursdayOpen,
      fridayStart: facility.fridayStart || orgHours.fridayStart,
      fridayEnd: facility.fridayEnd || orgHours.fridayEnd,
      fridayOpen: facility.fridayOpen !== null ? facility.fridayOpen : orgHours.fridayOpen,
      saturdayStart: facility.saturdayStart || orgHours.saturdayStart,
      saturdayEnd: facility.saturdayEnd || orgHours.saturdayEnd,
      saturdayOpen: facility.saturdayOpen !== null ? facility.saturdayOpen : orgHours.saturdayOpen,
      sundayStart: facility.sundayStart || orgHours.sundayStart,
      sundayEnd: facility.sundayEnd || orgHours.sundayEnd,
      sundayOpen: facility.sundayOpen !== null ? facility.sundayOpen : orgHours.sundayOpen,
      overrideOrganizationHours: true
    };
  }

  /**
   * Check if a given date/time is available considering hierarchical rules
   */
  async isTimeSlotAvailable(
    facilityId: number, 
    organizationId: number, 
    date: Date, 
    startTime: string, 
    endTime: string
  ): Promise<{ available: boolean; reason?: string }> {
    if (!this.storage) await this.initializeStorage();

    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.

    // Check if date is a holiday
    const holidays = await this.getEffectiveHolidays(facilityId, organizationId);
    const isHoliday = holidays.some(h => h.date === dateStr && h.isActive);
    
    if (isHoliday) {
      const holiday = holidays.find(h => h.date === dateStr);
      return { 
        available: false, 
        reason: `Facility closed for ${holiday?.name || 'holiday'}` 
      };
    }

    // Check operating hours
    const effectiveHours = await this.getEffectiveHours(facilityId, organizationId);
    
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[dayOfWeek];
    
    const dayOpen = effectiveHours[`${dayName}Open` as keyof FacilityHours] as boolean;
    const dayStart = effectiveHours[`${dayName}Start` as keyof FacilityHours] as string;
    const dayEnd = effectiveHours[`${dayName}End` as keyof FacilityHours] as string;

    if (!dayOpen) {
      return { 
        available: false, 
        reason: `Facility closed on ${dayName}s` 
      };
    }

    if (!dayStart || !dayEnd) {
      return { 
        available: false, 
        reason: `Operating hours not configured for ${dayName}s` 
      };
    }

    // Check if requested time is within operating hours
    if (startTime < dayStart || endTime > dayEnd) {
      return { 
        available: false, 
        reason: `Outside operating hours (${dayStart} - ${dayEnd})` 
      };
    }

    return { available: true };
  }

  private async getOrganizationHolidays(organizationId: number): Promise<HolidayRule[]> {
    // This would query organization-level holidays from the database
    // For now, return empty array as we'll implement the actual DB schema later
    return [];
  }

  private async getFacilityHolidays(facilityId: number): Promise<HolidayRule[]> {
    // This would query facility-level holiday overrides from the database
    // For now, return empty array as we'll implement the actual DB schema later
    return [];
  }
}

export const hierarchicalAvailabilityService = new HierarchicalAvailabilityService();