/**
 * Generate a unique confirmation code for appointments
 * Format: HZL-XXXXXX (where XXXXXX is a 6-digit number)
 */
export function generateConfirmationCode(): string {
  const prefix = 'HZL';
  const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  
  return `${prefix}-${timestamp}${random}`;
}

/**
 * Generate a shorter confirmation code for appointments
 * Format: XXXXXX (6-digit number)
 */
export function generateShortConfirmationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
} 