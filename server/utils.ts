/**
 * Generate a unique confirmation code for appointments
 * Format: ORG-XXXXXX (where ORG is organization prefix and XXXXXX is a 6-digit number)
 */
export function generateConfirmationCode(organizationPrefix?: string): string {
  // Use organization-specific prefix, fallback to first 3 chars of name, or default to 'APP'
  const prefix = organizationPrefix?.toUpperCase().slice(0, 5) || 'APP'; // Allow up to 5 chars
  const timestamp = Date.now().toString().slice(-4); // Last 4 digits of timestamp
  const random = Math.floor(Math.random() * 100).toString().padStart(2, '0'); // 2 digit random
  
  return `${prefix}-${timestamp}${random}`;
}

/**
 * Get organization-specific confirmation code prefix from organization settings
 */
export async function getOrganizationConfirmationPrefix(tenantId: number): Promise<string> {
  try {
    const { getStorage } = await import('./storage');
    const storage = await getStorage();
    const organization = await storage.getOrganization(tenantId);
    
    if (!organization) {
      return 'APP'; // Default fallback
    }
    
    // Check settings first, then fallback to organization name
    const settings = organization.settings as any;
    const prefix = settings?.confirmationCodePrefix || 
                  organization.name?.slice(0, 3).toUpperCase() || 
                  'APP';
                  
    return prefix;
  } catch (error) {
    console.error('Error getting organization confirmation prefix:', error);
    return 'APP'; // Safe fallback
  }
}

/**
 * Generate a shorter confirmation code for appointments
 * Format: XXXXXX (6-digit number)
 */
export function generateShortConfirmationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
} 