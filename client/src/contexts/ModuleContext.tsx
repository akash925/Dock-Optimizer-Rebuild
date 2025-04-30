import { createContext, useContext, ReactNode, useMemo, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export interface OrgModule {
  moduleName: string;
  enabled: boolean;
}

interface ModuleContextType {
  modules: OrgModule[];
  isModuleEnabled: (moduleName: string) => boolean;
  isLoading: boolean;
  refetchModules: () => Promise<void>;
  logModuleState: () => void;
}

const ModuleContext = createContext<ModuleContextType | undefined>(undefined);

// Default modules to enable base functionality
const DEFAULT_MODULES: OrgModule[] = [
  { moduleName: 'appointments', enabled: true },
  { moduleName: 'doorManager', enabled: true },
  { moduleName: 'calendar', enabled: false },
  { moduleName: 'analytics', enabled: false },
  { moduleName: 'bookingPages', enabled: false },
  { moduleName: 'assetManager', enabled: false },
  { moduleName: 'facilityManagement', enabled: true },
  { moduleName: 'userManagement', enabled: true },
  { moduleName: 'emailNotifications', enabled: false },
];

// Fixed module names for validation and consistency
export const AVAILABLE_MODULES = [
  'appointments', 'doorManager', 'calendar', 'analytics', 
  'bookingPages', 'assetManager', 'facilityManagement', 
  'userManagement', 'emailNotifications'
];

export function ModuleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Use TanStack Query instead of local state for modules
  // This avoids double state that can lead to infinite re-renders
  const { 
    data: modules = DEFAULT_MODULES, 
    isLoading, 
    refetch 
  } = useQuery<OrgModule[]>({
    queryKey: ['modules'],
    queryFn: async () => {
      if (!user) return DEFAULT_MODULES;
      
      try {
        const response = await fetch('/api/modules');
        if (!response.ok) {
          console.warn('Failed to fetch modules, using defaults');
          return DEFAULT_MODULES;
        }
        
        const data = await response.json();
        console.log('Current modules state:', data);
        return data;
      } catch (error) {
        console.error('Error fetching modules:', error);
        return DEFAULT_MODULES;
      }
    },
    // Only run query when user is authenticated
    enabled: !!user,
    // Don't refetch on window focus to avoid flickering
    refetchOnWindowFocus: false,
    // Cache for 5 minutes (300000ms) unless explicitly invalidated
    staleTime: 300000,
    // Set a reasonable cache time
    gcTime: 600000,
  });
  
  // Utility function to log current module state - helpful for debugging
  const logModuleState = useCallback(() => {
    console.log('Current modules state:', modules);
  }, [modules]);
  
  // Clear module cache on logout
  useEffect(() => {
    if (!user) {
      queryClient.invalidateQueries({ queryKey: ['modules'] });
    }
  }, [user, queryClient]);
  
  // Memoize the module check function for performance
  const isModuleEnabled = useCallback((moduleName: string) => {
    // If not specified, consider it enabled
    if (!moduleName) return true;
    
    // Check if module exists and is enabled
    return modules.some(m => m.moduleName === moduleName && m.enabled);
  }, [modules]);
  
  // Refetch modules function for manual refresh
  const refetchModules = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['modules'] });
    await refetch();
  }, [queryClient, refetch]);
  
  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    modules,
    isModuleEnabled,
    isLoading,
    refetchModules,
    logModuleState
  }), [modules, isModuleEnabled, isLoading, refetchModules, logModuleState]);
  
  return (
    <ModuleContext.Provider value={contextValue}>
      {children}
    </ModuleContext.Provider>
  );
}

export function useModules() {
  const context = useContext(ModuleContext);
  if (context === undefined) {
    throw new Error('useModules must be used within a ModuleProvider');
  }
  return context;
}