// Available modules that can be enabled per tenant
export const AvailableModule = {
  APPOINTMENTS: "appointments",
  CALENDAR: "calendar",
  ASSET_MANAGER: "companyAssets",
  EMAIL_NOTIFICATIONS: "emailNotifications",
  ANALYTICS: "analytics",
  BOOKING_PAGES: "bookingPages",
  FACILITY_MANAGEMENT: "facilityManagement",
  DOOR_MANAGER: "doorManager",
  USER_MANAGEMENT: "userManagement",
  HOURS: "hours",
  FEATURE_FLAGS: "featureFlags",
} as const;

export type AvailableModule =
  | 'calendar'
  | 'companyAssets'
  | 'analytics'
  | 'appointments'
  | 'bookingPages'
  | 'hours'
  | 'featureFlags'
  | 'emailNotifications'
  | 'facilityManagement'
  | 'doorManager'
  | 'userManagement'; 