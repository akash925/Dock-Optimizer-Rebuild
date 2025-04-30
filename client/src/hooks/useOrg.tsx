import { useMemo, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/queryClient';
import { OrgModule, AVAILABLE_MODULES } from '@/contexts/ModuleContext';

interface Organization {
  id: number;
  name: string;
  modules: OrgModule[];
  // Add other org properties as needed
}

interface AdminApiClient {
  toggleOrgModule: (orgId: number, moduleName: string, enabled: boolean) => Promise<OrgModule>;
}

// Create a client for interacting with admin APIs
const createAdminApiClient = (): AdminApiClient => {
  return {
    // Toggle a single module for an organization
    toggleOrgModule: async (orgId: number, moduleName: string, enabled: boolean): Promise<OrgModule> => {
      if (!AVAILABLE_MODULES.includes(moduleName)) {
        throw new Error(`Invalid module name: ${moduleName}`);
      }
      
      try {
        const response = await apiRequest(
          'PUT', 
          `/api/admin/orgs/${orgId}/modules/${moduleName}`,
          { enabled }
        );
        
        if (!response.ok) {
          throw new Error(`Failed to toggle module: ${response.statusText}`);
        }
        
        // Return the updated module
        return await response.json();
      } catch (error) {
        console.error('Error toggling module:', error);
        throw error;
      }
    }
  };
};

const fetchOrg = async (orgId: number): Promise<Organization> => {
  try {
    const res = await apiRequest('GET', `/api/admin/orgs/${orgId}/detail`);
    
    if (!res.ok) {
      throw new Error(`Failed to fetch organization: ${res.statusText}`);
    }
    
    const data = await res.json();
    return data.organization || data;
  } catch (error) {
    console.error('Error fetching organization:', error);
    throw error;
  }
};

export const useOrg = (orgId?: number) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // If no orgId provided, use the user's tenantId (organization id)
  const effectiveOrgId = orgId || user?.tenantId;
  
  const { 
    data: org,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['org', effectiveOrgId],
    queryFn: () => fetchOrg(effectiveOrgId),
    enabled: !!effectiveOrgId,
    staleTime: 300000, // Cache for 5 minutes
    retry: 1, // Only retry once to avoid flooding the server
  });

  // Create admin API client with module toggle functionality
  const adminApi = useMemo(() => createAdminApiClient(), []);

  // Extract module names that are enabled
  const enabledModules = useMemo(() => {
    const modules = org?.modules || [];
    // Map to just the module names of enabled modules
    return modules
      .filter(m => m.enabled)
      .map(m => m.moduleName);
  }, [org?.modules]);
  
  // Log for debugging purposes
  useEffect(() => {
    console.log('Organization:', org?.name);
    console.log('Enabled Modules:', enabledModules);
    console.log('Sidebar: useOrg enabled modules:', enabledModules);
  }, [org?.name, enabledModules]);

  // Toggle module function that invalidates all related queries
  const toggleModule = useCallback(async (moduleName: string, enabled: boolean) => {
    if (!effectiveOrgId) {
      throw new Error('No organization ID available');
    }
    
    try {
      // Call the API to toggle the module
      await adminApi.toggleOrgModule(effectiveOrgId, moduleName, enabled);
      
      // Invalidate both the organization and modules queries
      queryClient.invalidateQueries({ queryKey: ['org', effectiveOrgId] });
      queryClient.invalidateQueries({ queryKey: ['modules'] });
      
      // Refetch the org data to update the UI
      await refetch();
      
      return true;
    } catch (error) {
      console.error('Error toggling module:', error);
      return false;
    }
  }, [effectiveOrgId, adminApi, queryClient, refetch]);

  return { 
    org, 
    enabledModules, 
    isLoading,
    error,
    orgId: effectiveOrgId,
    toggleModule,
    refetchOrg: refetch
  };
};