import { Request, Response } from 'express';
import { getStorage } from '../../storage';

/**
 * Get current organization information
 */
export const getCurrentOrganization = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;
    
    if (!userId || !tenantId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    console.log(`DEBUG: [Organizations] Getting organization for tenantId: ${tenantId}`);

    const storage = await getStorage();
    const organization = await storage.getOrganization(tenantId);
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    return res.json(organization);
  } catch (error) {
    console.error('Error fetching current organization:', error);
    return res.status(500).json({ error: 'Failed to fetch organization' });
  }
};

/**
 * Update current organization information
 */
export const updateCurrentOrganization = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;
    
    if (!userId || !tenantId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const { name, description, contactEmail, contactPhone, address, timezone } = req.body;

    console.log(`DEBUG: [Organizations] Updating organization ${tenantId} with data:`, {
      name, description, contactEmail, contactPhone, address, timezone
    });

    const storage = await getStorage();
    const updatedOrganization = await storage.updateOrganization(tenantId, {
      name,
      description,
      contactEmail,
      contactPhone,
      address,
      timezone,
      lastModifiedBy: userId,
      lastModifiedAt: new Date()
    });

    if (!updatedOrganization) {
      return res.status(404).json({ error: 'Organization not found or update failed' });
    }

    return res.json(updatedOrganization);
  } catch (error) {
    console.error('Error updating organization:', error);
    return res.status(500).json({ error: 'Failed to update organization' });
  }
};

/**
 * Get organization default hours
 */
export const getDefaultHours = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    
    if (!tenantId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    console.log(`DEBUG: [Organizations] Getting default hours for tenantId: ${tenantId}`);

    const storage = await getStorage();
    const defaultHours = await storage.getOrganizationDefaultHours(tenantId);

    // Ensure we have entries for all 7 days of the week
    const daysOfWeek = [
      { value: 0, label: 'Sunday' },
      { value: 1, label: 'Monday' },
      { value: 2, label: 'Tuesday' },
      { value: 3, label: 'Wednesday' },
      { value: 4, label: 'Thursday' },
      { value: 5, label: 'Friday' },
      { value: 6, label: 'Saturday' }
    ];

    const completeHours = daysOfWeek.map(day => {
      const existingHour = defaultHours.find(h => h.dayOfWeek === day.value);
      return existingHour || {
        id: 0,
        dayOfWeek: day.value,
        dayName: day.label,
        isOpen: day.value >= 1 && day.value <= 5, // Default: Monday-Friday open
        openTime: '09:00',
        closeTime: '17:00',
        breakStart: '',
        breakEnd: ''
      };
    });

    return res.json(completeHours);
  } catch (error) {
    console.error('Error fetching default hours:', error);
    return res.status(500).json({ error: 'Failed to fetch default hours' });
  }
};

/**
 * Update organization default hours
 */
export const updateDefaultHours = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    
    if (!tenantId || !userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const { dayOfWeek, isOpen, openTime, closeTime, breakStart, breakEnd } = req.body;

    if (dayOfWeek === undefined || typeof dayOfWeek !== 'number' || dayOfWeek < 0 || dayOfWeek > 6) {
      return res.status(400).json({ error: 'Valid dayOfWeek (0-6) is required' });
    }

    console.log(`DEBUG: [Organizations] Updating default hours for day ${dayOfWeek}:`, {
      isOpen, openTime, closeTime, breakStart, breakEnd
    });

    const storage = await getStorage();
    const updatedHours = await storage.updateOrganizationDefaultHours(tenantId, {
      dayOfWeek,
      isOpen: isOpen || false,
      openTime: isOpen ? (openTime || '09:00') : '',
      closeTime: isOpen ? (closeTime || '17:00') : '',
      breakStart: isOpen ? (breakStart || '') : '',
      breakEnd: isOpen ? (breakEnd || '') : '',
      updatedBy: userId
    });

    return res.json(updatedHours);
  } catch (error) {
    console.error('Error updating default hours:', error);
    return res.status(500).json({ error: 'Failed to update default hours' });
  }
};

/**
 * Get organization holidays
 */
export const getHolidays = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    
    if (!tenantId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    console.log(`DEBUG: [Organizations] Getting holidays for tenantId: ${tenantId}`);

    const storage = await getStorage();
    const holidays = await storage.getOrganizationHolidays(tenantId);

    return res.json(holidays);
  } catch (error) {
    console.error('Error fetching holidays:', error);
    return res.status(500).json({ error: 'Failed to fetch holidays' });
  }
};

/**
 * Create organization holiday
 */
export const createHoliday = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    
    if (!tenantId || !userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const { name, date, isRecurring, description } = req.body;

    if (!name || !date) {
      return res.status(400).json({ error: 'Holiday name and date are required' });
    }

    console.log(`DEBUG: [Organizations] Creating holiday:`, {
      name, date, isRecurring, description
    });

    const storage = await getStorage();
    const holiday = await storage.createOrganizationHoliday({
      tenantId,
      name,
      date,
      isRecurring: isRecurring || false,
      description: description || '',
      createdBy: userId
    });

    return res.status(201).json(holiday);
  } catch (error) {
    console.error('Error creating holiday:', error);
    return res.status(500).json({ error: 'Failed to create holiday' });
  }
};

/**
 * Update organization holiday
 */
export const updateHoliday = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    const holidayId = Number(req.params.id);
    
    if (!tenantId || !userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    if (isNaN(holidayId)) {
      return res.status(400).json({ error: 'Valid holiday ID is required' });
    }

    const { name, date, isRecurring, description } = req.body;

    console.log(`DEBUG: [Organizations] Updating holiday ${holidayId}:`, {
      name, date, isRecurring, description
    });

    const storage = await getStorage();
    const updatedHoliday = await storage.updateOrganizationHoliday(holidayId, {
      name,
      date,
      isRecurring,
      description,
      updatedBy: userId
    });

    if (!updatedHoliday) {
      return res.status(404).json({ error: 'Holiday not found or update failed' });
    }

    return res.json(updatedHoliday);
  } catch (error) {
    console.error('Error updating holiday:', error);
    return res.status(500).json({ error: 'Failed to update holiday' });
  }
};

/**
 * Delete organization holiday
 */
export const deleteHoliday = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const holidayId = Number(req.params.id);
    
    if (!tenantId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    if (isNaN(holidayId)) {
      return res.status(400).json({ error: 'Valid holiday ID is required' });
    }

    console.log(`DEBUG: [Organizations] Deleting holiday ${holidayId}`);

    const storage = await getStorage();
    const success = await storage.deleteOrganizationHoliday(holidayId, tenantId);

    if (!success) {
      return res.status(404).json({ error: 'Holiday not found or delete failed' });
    }

    return res.status(204).end();
  } catch (error) {
    console.error('Error deleting holiday:', error);
    return res.status(500).json({ error: 'Failed to delete holiday' });
  }
};

/**
 * Get organization modules
 */
export const getOrganizationModules = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    
    if (!tenantId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    console.log(`DEBUG: [Organizations] Getting modules for tenantId: ${tenantId}`);

    const storage = await getStorage();
    const modules = await storage.getOrganizationModules(tenantId);

    return res.json(modules);
  } catch (error) {
    console.error('Error fetching organization modules:', error);
    return res.status(500).json({ error: 'Failed to fetch organization modules' });
  }
};

/**
 * Update organization module
 */
export const updateOrganizationModule = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    
    if (!tenantId || !userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const { moduleName, enabled } = req.body;

    if (!moduleName || typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'Module name and enabled status are required' });
    }

    console.log(`DEBUG: [Organizations] Updating module ${moduleName} to ${enabled}`);

    const storage = await getStorage();
    const updatedModule = await storage.updateOrganizationModule(tenantId, moduleName, enabled);

    if (!updatedModule) {
      return res.status(404).json({ error: 'Module not found or update failed' });
    }

    return res.json(updatedModule);
  } catch (error) {
    console.error('Error updating organization module:', error);
    return res.status(500).json({ error: 'Failed to update organization module' });
  }
};

/**
 * Get organization settings
 */
export const getOrganizationSettings = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    
    if (!tenantId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    console.log(`DEBUG: [Organizations] Getting settings for tenantId: ${tenantId}`);

    const storage = await getStorage();
    const organization = await storage.getOrganization(tenantId);
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Extract settings or provide defaults
    const settings = organization.settings || {};
    const organizationSettings = {
      confirmationCodePrefix: settings.confirmationCodePrefix || organization.name?.slice(0, 3).toUpperCase() || 'APP',
      emailNotifications: settings.emailNotifications !== false, // Default to true
      timezone: organization.timezone || 'America/New_York',
      logo: organization.logo,
      ...settings
    };

    return res.json(organizationSettings);
  } catch (error) {
    console.error('Error fetching organization settings:', error);
    return res.status(500).json({ error: 'Failed to fetch organization settings' });
  }
};

/**
 * Update organization settings
 */
export const updateOrganizationSettings = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    
    if (!tenantId || !userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const { confirmationCodePrefix, emailNotifications, timezone, ...otherSettings } = req.body;

    console.log(`DEBUG: [Organizations] Updating settings for tenantId: ${tenantId}`, {
      confirmationCodePrefix, emailNotifications, timezone, otherSettings
    });

    // Validate confirmation code prefix
    if (confirmationCodePrefix && (confirmationCodePrefix.length < 2 || confirmationCodePrefix.length > 5)) {
      return res.status(400).json({ error: 'Confirmation code prefix must be 2-5 characters long' });
    }

    if (confirmationCodePrefix && !/^[A-Z0-9]+$/.test(confirmationCodePrefix)) {
      return res.status(400).json({ error: 'Confirmation code prefix must contain only uppercase letters and numbers' });
    }

    const storage = await getStorage();
    
    // Get current organization to merge settings
    const currentOrg = await storage.getOrganization(tenantId);
    if (!currentOrg) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Merge existing settings with new ones
    const currentSettings = currentOrg.settings || {};
    const newSettings = {
      ...currentSettings,
      ...otherSettings,
      ...(confirmationCodePrefix && { confirmationCodePrefix: confirmationCodePrefix.toUpperCase() }),
      ...(emailNotifications !== undefined && { emailNotifications }),
      ...(timezone && { timezone })
    };

    // Update organization with new settings
    const updatedOrganization = await storage.updateOrganization(tenantId, {
      settings: newSettings,
      ...(timezone && { timezone }),
      lastModifiedBy: userId,
      lastModifiedAt: new Date()
    });

    if (!updatedOrganization) {
      return res.status(404).json({ error: 'Organization not found or update failed' });
    }

    return res.json({
      confirmationCodePrefix: newSettings.confirmationCodePrefix,
      emailNotifications: newSettings.emailNotifications,
      timezone: updatedOrganization.timezone,
      ...newSettings
    });
  } catch (error) {
    console.error('Error updating organization settings:', error);
    return res.status(500).json({ error: 'Failed to update organization settings' });
  }
};