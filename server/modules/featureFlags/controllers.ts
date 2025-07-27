import { Request, Response } from 'express';
import { featureFlagService } from './service.js';
import { AvailableModule } from '@shared/schema';

export const getModuleStatus = async (req: Request, res: Response) => {
  try {
    const tenantId = parseInt(req.params.tenantId);
    const moduleName = req.params.moduleName as AvailableModule;
    
    if (isNaN(tenantId)) {
      return res.status(400).json({ message: 'Invalid tenant ID' });
    }
    
    if (!Object.values(AvailableModule).includes(moduleName)) {
      return res.status(400).json({ message: 'Invalid module name' });
    }
    
    const isEnabled = await featureFlagService.isModuleEnabled(tenantId, moduleName);
    return res.status(200).json({ enabled: isEnabled });
  } catch (error) {
    console.error('Error getting module status:', error);
    return res.status(500).json({ message: 'Failed to get module status' });
  }
};

export const getEnabledModules = async (req: Request, res: Response) => {
  try {
    const tenantId = parseInt(req.params.tenantId);
    
    if (isNaN(tenantId)) {
      return res.status(400).json({ message: 'Invalid tenant ID' });
    }
    
    const modules = await featureFlagService.getEnabledModules(tenantId);
    return res.status(200).json(modules);
  } catch (error) {
    console.error('Error getting enabled modules:', error);
    return res.status(500).json({ message: 'Failed to get enabled modules' });
  }
};

export const enableModule = async (req: Request, res: Response) => {
  try {
    const tenantId = parseInt(req.params.tenantId);
    const moduleName = req.params.moduleName as AvailableModule;
    const { settings } = req.body;
    
    if (isNaN(tenantId)) {
      return res.status(400).json({ message: 'Invalid tenant ID' });
    }
    
    if (!Object.values(AvailableModule).includes(moduleName)) {
      return res.status(400).json({ message: 'Invalid module name' });
    }
    
    const success = await featureFlagService.enableModule(tenantId, moduleName, settings);
    
    if (success) {
      return res.status(200).json({ message: `Module ${moduleName} enabled for tenant ${tenantId}` });
    } else {
      return res.status(500).json({ message: 'Failed to enable module' });
    }
  } catch (error) {
    console.error('Error enabling module:', error);
    return res.status(500).json({ message: 'Failed to enable module' });
  }
};

export const disableModule = async (req: Request, res: Response) => {
  try {
    const tenantId = parseInt(req.params.tenantId);
    const moduleName = req.params.moduleName as AvailableModule;
    
    if (isNaN(tenantId)) {
      return res.status(400).json({ message: 'Invalid tenant ID' });
    }
    
    if (!Object.values(AvailableModule).includes(moduleName)) {
      return res.status(400).json({ message: 'Invalid module name' });
    }
    
    const success = await featureFlagService.disableModule(tenantId, moduleName);
    
    if (success) {
      return res.status(200).json({ message: `Module ${moduleName} disabled for tenant ${tenantId}` });
    } else {
      return res.status(500).json({ message: 'Failed to disable module' });
    }
  } catch (error) {
    console.error('Error disabling module:', error);
    return res.status(500).json({ message: 'Failed to disable module' });
  }
};

export const updateModuleSettings = async (req: Request, res: Response) => {
  try {
    const tenantId = parseInt(req.params.tenantId);
    const moduleName = req.params.moduleName as AvailableModule;
    const { settings } = req.body;
    
    if (isNaN(tenantId)) {
      return res.status(400).json({ message: 'Invalid tenant ID' });
    }
    
    if (!Object.values(AvailableModule).includes(moduleName)) {
      return res.status(400).json({ message: 'Invalid module name' });
    }
    
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ message: 'Invalid settings object' });
    }
    
    const success = await featureFlagService.updateModuleSettings(tenantId, moduleName, settings);
    
    if (success) {
      return res.status(200).json({ message: `Settings updated for module ${moduleName}` });
    } else {
      return res.status(404).json({ message: 'Module not found for tenant' });
    }
  } catch (error) {
    console.error('Error updating module settings:', error);
    return res.status(500).json({ message: 'Failed to update module settings' });
  }
};