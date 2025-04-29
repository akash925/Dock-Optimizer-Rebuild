import { createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';

export interface OrgModule {
  moduleName: string;
  enabled: boolean;
}

interface ModuleContextType {
  modules: OrgModule[];
  isModuleEnabled: (moduleName: string) => boolean;
  setModules: (modules: OrgModule[]) => void;
}

const ModuleContext = createContext<ModuleContextType | undefined>(undefined);

export function ModuleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [modules, setModules] = useState<OrgModule[]>([]);
  
  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    modules,
    isModuleEnabled: (moduleName: string) => {
      return modules.some(m => m.moduleName === moduleName && m.enabled);
    },
    setModules
  }), [modules]);
  
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