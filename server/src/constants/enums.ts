// Appointment Status Enums
export enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in-progress', 
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no-show'
}

export enum AppointmentType {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound'
}

// User Role Enums
export enum UserRole {
  WORKER = 'worker',
  MANAGER = 'manager',
  ADMIN = 'admin', 
  SUPER_ADMIN = 'super-admin'
}

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
  STATUSES: [AppointmentStatus.SCHEDULED, AppointmentStatus.IN_PROGRESS, AppointmentStatus.COMPLETED],
  TYPES: [AppointmentType.INBOUND, AppointmentType.OUTBOUND]
} as const;

// Common Error Messages
export const ERROR_MESSAGES = {
  AUTHENTICATION_REQUIRED: 'Authentication required',
  INSUFFICIENT_PERMISSIONS: 'Insufficient permissions',
  ADMIN_ACCESS_REQUIRED: 'Admin access required',
  NOT_AUTHENTICATED: 'Not authenticated',
  UNAUTHORIZED: 'Unauthorized',
  TENANT_ACCESS_DENIED: 'Access denied to this tenant resource',
  FACILITY_ACCESS_DENIED: 'Access denied to this facility',
  RESOURCE_NOT_FOUND: 'Resource not found',
  INVALID_PARAMETERS: 'Invalid parameters provided'
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  CREATED: 'Resource created successfully',
  UPDATED: 'Resource updated successfully', 
  DELETED: 'Resource deleted successfully',
  SAMPLE_DATA_CREATED: 'Sample data created successfully'
} as const; 