import { createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';

export interface OrgModule {
  moduleName: string;
  enabled: boolean;
}

interface ModuleContextType {
  modules: OrgModule[];
  isModuleEnabled: (moduleName: string) => boolean;
  setModules: (modules: OrgModule[]) => void;
  isLoading: boolean;
  refetchModules: () => Promise<void>;
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
];

export function ModuleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [modules, setModules] = useState<OrgModule[]>(DEFAULT_MODULES);
  
  // Fetch modules from API when user is authenticated
  const { data: moduleData, isLoading, refetch } = useQuery({
    queryKey: ['/api/modules'],
    queryFn: async () => {
      if (!user) return null;
      
      try {
        const response = await fetch('/api/modules');
        if (!response.ok) {
          // If API fails, fall back to default modules
          console.warn('Failed to fetch modules, using defaults');
          return DEFAULT_MODULES;
        }
        
        const data = await response.json();
        return data;
      } catch (error) {
        console.error('Error fetching modules:', error);
        return DEFAULT_MODULES;
      }
    },
    // Only run query when user is authenticated
    enabled: !!user,
    // Don't refetch on window focus to avoid flickering
    refetchOnWindowFocus: false
  });
  
  // Update modules when data is fetched
  useEffect(() => {
    if (moduleData && Array.isArray(moduleData)) {
      setModules(moduleData);
    }
  }, [moduleData]);
  
  // Refetch modules function for manual refresh
  const refetchModules = async () => {
    await refetch();
  };
  
  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    modules,
    isModuleEnabled: (moduleName: string) => {
      // If not specified, consider it enabled
      if (!moduleName) return true;
      
      // Check if module exists and is enabled
      return modules.some(m => m.moduleName === moduleName && m.enabled);
    },
    setModules,
    isLoading,
    refetchModules
  }), [modules, isLoading, refetch]);
  
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