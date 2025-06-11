// Client-side constants to avoid hardcoded values throughout the app

export const DEFAULT_TIMEZONE = 'America/New_York';

export const US_TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" }
];

export const DEFAULT_BUSINESS_HOURS = {
  start: "08:00",
  end: "17:00",
  weekdaysOpen: true,
  weekendsOpen: false
};

export const DEFAULT_APPOINTMENT_SETTINGS = {
  duration: 60, // minutes
  bufferTime: 0, // minutes
  maxConcurrent: 1,
  intervalMinutes: 30
};

export const FILE_UPLOAD_LIMITS = {
  BOL_MAX_SIZE_MB: 10,
  IMAGE_MAX_SIZE_MB: 5,
  ACCEPTED_BOL_TYPES: '.pdf,.jpg,.jpeg,.png,.tiff,.doc,.docx,application/pdf,image/*,application/msword'
};

export const EMAIL_SETTINGS = {
  REMINDER_HOURS_DEFAULT: 24,
  MAX_RESEND_ATTEMPTS: 3
};

export const UI_SETTINGS = {
  DEFAULT_ENTRIES_PER_PAGE: 10,
  DEFAULT_TIME_FORMAT: '12h',
  DOCK_STATUS_COLORS: {
    available: 'bg-green-100 border-green-300',
    occupied: 'bg-red-100 border-red-300',
    reserved: 'bg-yellow-100 border-yellow-300',
    maintenance: 'bg-gray-100 border-gray-300'
  }
}; 