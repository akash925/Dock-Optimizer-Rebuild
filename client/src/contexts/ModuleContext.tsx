import { createContext, useContext, ReactNode, useMemo, useRef, useCallback } from 'react';
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
  
  // Use TanStack Query to handle the module state 
  const { 
    data: modules = DEFAULT_MODULES, 
    isLoading, 
    refetch 
  } = useQuery<OrgModule[]>({
    queryKey: ['modules'],
    queryFn: async () => {
      if (!user) return DEFAULT_MODULES;
      
      try {
        // Add a cache-busting query parameter to avoid browser caching
        const timestamp = new Date().getTime();
        const response = await fetch(`/api/modules?_t=${timestamp}`, {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });
        
        if (!response.ok) {
          console.warn('Failed to fetch modules, using defaults');
          return DEFAULT_MODULES;
        }
        
        const data = await response.json();
        if (!Array.isArray(data)) {
          console.error('Invalid modules data format, using defaults');
          return DEFAULT_MODULES;
        }
        
        return data;
      } catch (error) {
        console.error('Error fetching modules:', error);
        return DEFAULT_MODULES;
      }
    },
    retry: 2,
    staleTime: 300000, // 5 minutes
    gcTime: 600000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: true,
    // Properly type refetchInterval as false, not boolean
    refetchInterval: false as const,
    enabled: !!user
  });
  
  // Utility function to log current module state - helpful for debugging
  const logModuleState = useCallback(() => {
    console.log('Current modules state:', modules);
  }, [modules]);
  
  // Memoize the module check function for performance
  const isModuleEnabled = useCallback((moduleName: string) => {
    // Critical modules that should always be enabled
    if (moduleName === 'appointments') {
      return true; 
    }
    if (!moduleName) return true;
    
    // Safely check if module exists and is enabled
    // Add type guard to ensure we're working with an array
    if (!Array.isArray(modules)) {
      return false;
    }
    
    return modules.some((m: OrgModule) => m.moduleName === moduleName && m.enabled);
  }, [modules]);
  
  // Refetch modules function for manual refresh
  const refetchModules = useCallback(async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: ['modules'] });
      await refetch();
      return Promise.resolve();
    } catch (error) {
      console.error('Failed to refresh modules:', error);
      return Promise.reject(error);
    }
  }, [queryClient, refetch]);
  
  // Memoize the context value to prevent unnecessary re-renders
  // This is critical to avoid re-rendering loops
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