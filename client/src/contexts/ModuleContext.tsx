import { createContext, useContext, ReactNode, useMemo, useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

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
  enabledModuleNames: string[];
}

const ModuleContext = createContext<ModuleContextType | undefined>(undefined);

// Default modules to enable base functionality
const DEFAULT_MODULES: OrgModule[] = [
  { moduleName: 'appointments', enabled: true },
  { moduleName: 'doorManager', enabled: true },
  { moduleName: 'calendar', enabled: false },
  { moduleName: 'analytics', enabled: false },
  { moduleName: 'bookingPages', enabled: false },
  { moduleName: 'companyAssets', enabled: true },
  { moduleName: 'facilityManagement', enabled: true },
  { moduleName: 'userManagement', enabled: true },
  { moduleName: 'emailNotifications', enabled: false },
];

// Fixed module names for validation and consistency
export const AVAILABLE_MODULES = [
  'appointments', 'doorManager', 'calendar', 'analytics', 
  'bookingPages', 'companyAssets', 'facilityManagement', 
  'userManagement', 'emailNotifications'
];

export function ModuleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Use TanStack Query to handle the module state 
  const { 
    data: modules = DEFAULT_MODULES, 
    isLoading, 
    refetch,
    error
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
        
        // If organization has no modules configured, use defaults
        if (data.length === 0) {
          console.log(`[ModuleContext] Organization has no modules configured, using default modules for user ${user.username} (tenant ${user.tenantId})`);
          return DEFAULT_MODULES;
        }
        
        // Log when modules are successfully fetched
        console.log(`[ModuleContext] Successfully fetched ${data.length} modules for user ${user.username} (tenant ${user.tenantId})`);
        
        return data;
      } catch (error) {
        console.error('Error fetching modules:', error);
        return DEFAULT_MODULES;
      }
    },
    retry: 2,
    staleTime: 60000, // 1 minute instead of 5 minutes for quicker updates
    gcTime: 120000, // 2 minutes
    refetchOnWindowFocus: true, // Enable to catch updates
    refetchOnMount: true,
    refetchOnReconnect: true,
    // Properly type refetchInterval as false, not boolean
    refetchInterval: false as const,
    enabled: !!user
  });
  
  // Show an error toast if modules can't be fetched
  useEffect(() => {
    if (error) {
      toast({
        title: "Failed to load modules",
        description: "Your access to features might be limited. Please try refreshing the page.",
        variant: "destructive"
      });
    }
  }, [error, toast]);
  
  // Compute enabled module names once
  const enabledModuleNames = useMemo(() => {
    if (!Array.isArray(modules)) return [];
    return modules
      .filter(m => m.enabled)
      .map(m => m.moduleName);
  }, [modules]);
  
  // Utility function to log current module state - helpful for debugging
  const logModuleState = useCallback(() => {
    console.log('[ModuleContext] Current modules state:', modules);
    console.log('[ModuleContext] Enabled modules:', enabledModuleNames);
  }, [modules, enabledModuleNames]);
  
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
    
    const isEnabled = modules.some((m: OrgModule) => m.moduleName === moduleName && m.enabled);
    return isEnabled;
  }, [modules]);
  
  // Refetch modules function for manual refresh
  const refetchModules = useCallback(async () => {
    try {
      console.log('[ModuleContext] Refreshing modules data...');
      await queryClient.invalidateQueries({ queryKey: ['modules'] });
      const result = await refetch();
      console.log('[ModuleContext] Modules refreshed successfully');
      return Promise.resolve();
    } catch (error) {
      console.error('[ModuleContext] Failed to refresh modules:', error);
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
    logModuleState,
    enabledModuleNames
  }), [modules, isModuleEnabled, isLoading, refetchModules, logModuleState, enabledModuleNames]);
  
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