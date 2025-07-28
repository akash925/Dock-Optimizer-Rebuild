/**
 * Environment helper that works in both client and server contexts
 * 
 * In server context: uses process.env
 * In client context: uses import.meta.env with VITE_ prefix
 */

function isServerEnvironment(): boolean {
  return typeof process !== 'undefined' && process.env && typeof window === 'undefined';
}

function getEnvVar(key: string, defaultValue: string = ''): string {
  if (isServerEnvironment()) {
    // Server-side: use process.env directly
    return process.env[key] || defaultValue;
  } else {
    // Client-side: use import.meta.env with VITE_ prefix
    const viteKey = `VITE_${key}`;
    return ((import.meta as any).env?.[viteKey] as string) || defaultValue;
  }
}

function getEnvInt(key: string, defaultValue: number = 0): number {
  const value = getEnvVar(key, defaultValue.toString());
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

// Export specific environment variables used in schema
export const ENV = {
  DEFAULT_START_TIME: getEnvVar('DEFAULT_START_TIME', '08:00'),
  DEFAULT_END_TIME: getEnvVar('DEFAULT_END_TIME', '17:00'),
  DEFAULT_BREAK_START: getEnvVar('DEFAULT_BREAK_START', '12:00'),
  DEFAULT_BREAK_END: getEnvVar('DEFAULT_BREAK_END', '13:00'),
  DEFAULT_BUFFER_TIME: getEnvInt('DEFAULT_BUFFER_TIME', 0),
  DEFAULT_GRACE_PERIOD: getEnvInt('DEFAULT_GRACE_PERIOD', 15),
  DEFAULT_EMAIL_REMINDER_HOURS: getEnvInt('DEFAULT_EMAIL_REMINDER_HOURS', 24),
  DEFAULT_MAX_CONCURRENT: getEnvInt('DEFAULT_MAX_CONCURRENT', 1),
  DEFAULT_FACILITY_TIMEZONE: getEnvVar('DEFAULT_FACILITY_TIMEZONE', 'America/New_York'),
};

export { getEnvVar, getEnvInt, isServerEnvironment }; 