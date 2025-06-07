// Authentication & Authorization
export const USER_ROLES = {
  ADMIN: 'admin',
  DOCK_MANAGER: 'dock_manager',
  USER: 'user',
  VIEWER: 'viewer'
} as const;

export const APPOINTMENT_STATUSES = {
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in-progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no-show',
  CHECKED_IN: 'checked-in'
} as const;

export const APPOINTMENT_TYPES = {
  PICKUP: 'pickup',
  DROPOFF: 'dropoff',
  DELIVERY: 'delivery',
  INBOUND: 'inbound',
  OUTBOUND: 'outbound'
} as const;

export const DOCK_STATUSES = {
  AVAILABLE: 'available',
  OCCUPIED: 'occupied',
  RESERVED: 'reserved',
  NOT_AVAILABLE: 'not_available',
  MAINTENANCE: 'maintenance'
} as const;

// Calendar & Time Constants
export const WEEKDAYS = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6
} as const;

export const WEEKDAY_NAMES = [
  'sunday',
  'monday', 
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday'
] as const;

export const BUSINESS_DAYS = [
  WEEKDAYS.MONDAY,
  WEEKDAYS.TUESDAY,
  WEEKDAYS.WEDNESDAY,
  WEEKDAYS.THURSDAY,
  WEEKDAYS.FRIDAY
] as const;

export const DEFAULT_BUSINESS_HOURS = {
  START: '08:00',
  END: '17:00',
  BREAK_START: '12:00',
  BREAK_END: '13:00'
} as const;

// System Constants
export const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'Insufficient permissions',
  NOT_FOUND: 'Resource not found',
  VALIDATION_ERROR: 'Validation failed',
  DATABASE_ERROR: 'Database operation failed',
  APPOINTMENT_CONFLICT: 'Appointment time conflicts with existing booking',
  FACILITY_CLOSED: 'Facility is closed at the requested time',
  DOCK_UNAVAILABLE: 'Selected dock is not available'
} as const;

export const SUCCESS_MESSAGES = {
  APPOINTMENT_CREATED: 'Appointment created successfully',
  APPOINTMENT_UPDATED: 'Appointment updated successfully', 
  APPOINTMENT_CANCELLED: 'Appointment cancelled successfully',
  DOOR_RELEASED: 'Door released successfully',
  USER_CREATED: 'User created successfully',
  FACILITY_UPDATED: 'Facility settings updated successfully'
} as const;

// OCR & Document Processing
export const OCR_STATUSES = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  RETRY: 'retry'
} as const;

// Email & Notification Types
export const EMAIL_TYPES = {
  CONFIRMATION: 'confirmation',
  REMINDER: 'reminder',
  CANCELLATION: 'cancellation',
  RESCHEDULED: 'rescheduled',
  CHECK_IN: 'check_in'
} as const;

// Logo & Branding Constants  
export const COMPANY_LOGOS = {
  FRESH_CONNECT: 'fresh_connect',
  HANZO: 'hanzo',
  DEFAULT: 'default'
} as const;

// Time Formats & Patterns
export const TIME_PATTERNS = {
  TIME_24H: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
  TIME_12H: /^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)$/i,
  DATE_ISO: /^\d{4}-\d{2}-\d{2}$/
} as const;

// API Response Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500
} as const;

// Type definitions for better TypeScript support
export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];
export type AppointmentStatus = typeof APPOINTMENT_STATUSES[keyof typeof APPOINTMENT_STATUSES];
export type AppointmentType = typeof APPOINTMENT_TYPES[keyof typeof APPOINTMENT_TYPES];
export type DockStatus = typeof DOCK_STATUSES[keyof typeof DOCK_STATUSES];
export type WeekdayName = typeof WEEKDAY_NAMES[number];
export type OCRStatus = typeof OCR_STATUSES[keyof typeof OCR_STATUSES];
export type EmailType = typeof EMAIL_TYPES[keyof typeof EMAIL_TYPES];
export type CompanyLogo = typeof COMPANY_LOGOS[keyof typeof COMPANY_LOGOS];

// Legacy enum support - use USER_ROLES constant instead

// Module Names
export enum ModuleName {
  ASSET_MANAGER = 'assetManager',
  FACILITY_MANAGEMENT = 'facilityManagement',
  CALENDAR = 'calendar',
  ANALYTICS = 'analytics'
}

// Facility Status
export enum FacilityStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  MAINTENANCE = 'maintenance'
}

// Organization Status
export enum OrganizationStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended'
}

// Dock Types
export enum DockType {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound', 
  BOTH = 'both'
}

// Asset Status
export enum AssetStatus {
  AVAILABLE = 'available',
  IN_USE = 'in-use',
  MAINTENANCE = 'maintenance',
  RETIRED = 'retired'
}

// Timezone Defaults
export const DEFAULT_TIMEZONE = 'America/New_York';

// Sample Data Configuration
export const SAMPLE_DATA_CONFIG = {
  APPOINTMENT_COUNT: 7,
  DEFAULT_APPOINTMENT_DURATION_HOURS: 2,
  START_HOUR: 9,
  HOUR_VARIATION: 8,
  STATUSES: [APPOINTMENT_STATUSES.SCHEDULED, APPOINTMENT_STATUSES.IN_PROGRESS, APPOINTMENT_STATUSES.COMPLETED],
  TYPES: [APPOINTMENT_TYPES.INBOUND, APPOINTMENT_TYPES.OUTBOUND]
} as const;

// Legacy: Use the ERROR_MESSAGES and SUCCESS_MESSAGES constants defined above 