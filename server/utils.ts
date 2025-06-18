/**
 * Generate a unique confirmation code for appointments
 * Format: ORG-XXXXXX (where ORG is organization prefix and XXXXXX is a 6-digit number)
 */
export function generateConfirmationCode(organizationPrefix?: string): string {
  // Use organization-specific prefix or default to 'APP'
  const prefix = organizationPrefix?.toUpperCase().slice(0, 3) || 'APP';
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