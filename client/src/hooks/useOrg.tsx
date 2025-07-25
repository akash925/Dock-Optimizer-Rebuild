import { useMemo, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/queryClient';
import { OrgModule, AVAILABLE_MODULES, useModules } from '@/contexts/ModuleContext';
import { toast } from '@/hooks/use-toast';

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
        // Add a cache-busting timestamp to prevent caching issues
        const timestamp = new Date().getTime();
        console.log(`[useOrg] Toggling module ${moduleName} to ${enabled} for org ${orgId}`);
        
        const response = await apiRequest(
          'PATCH', // Changed from PUT to PATCH to match server endpoint
          `/api/admin/orgs/${orgId}/modules/${moduleName}?_t=${timestamp}`,
          { enabled }
        );
        
        if (!response.ok) {
          throw new Error(`Failed to toggle module: ${response.statusText}`);
        }
        
        // Return the updated module
        return await response.json();
      } catch (error) {
        console.error('[useOrg] Error toggling module:', error);
        throw error;
      }
    }
  };
};

const fetchOrg = async (orgId: number): Promise<Organization | null> => {
  if (!orgId) return null;
  
  try {
    // Add a cache-busting timestamp
    const timestamp = new Date().getTime();
    console.log(`[useOrg] Fetching organization details for orgId: ${orgId}`);
    
    const res = await apiRequest('GET', `/api/admin/orgs/${orgId}/detail?_t=${timestamp}`);
    
    if (!res.ok) {
      if (res.status === 404) {
        console.warn(`[useOrg] Organization with ID ${orgId} not found`);
        return null; // Organization not found
      }
      throw new Error(`Failed to fetch organization: ${res.statusText}`);
    }
    
    const data = await res.json();
    console.log(`[useOrg] Successfully fetched org ${orgId} with ${data.modules?.length || 0} modules`);
    return data.organization || data;
  } catch (error) {
    console.error('[useOrg] Error fetching organization:', error);
    throw error;
  }
};

export const useOrg = (orgId?: number) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { refetchModules } = useModules();
  
  // If no orgId provided, use the user's tenantId (organization id)
  const effectiveOrgId = orgId || user?.tenantId || 0;
  
  // Define query configuration for the organization data
  const { 
    data: org,
    isLoading,
    error,
    refetch
  } = useQuery<Organization | null>({
    queryKey: ['org', effectiveOrgId],
    queryFn: () => fetchOrg(effectiveOrgId),
    retry: 1,
    staleTime: 60000, // 1 minute instead of 5 minutes for quicker updates
    gcTime: 120000, // 2 minutes
    refetchOnWindowFocus: true, // Enable to catch updates
    refetchOnMount: true,
    refetchOnReconnect: true,
    refetchInterval: false as const, // Properly type this as false, not boolean
    enabled: effectiveOrgId > 0
  });

  // Create admin API client
  const adminApi = useMemo(() => createAdminApiClient(), []);

  // Extract module names that are enabled - memoized for performance
  const enabledModules = useMemo(() => {
    const modules = org?.modules || [];
    return modules
      .filter((m: any) => m.enabled)
      .map((m: any) => m.moduleName);
  }, [org?.modules]);
  
  // Setup module toggle mutation
  const moduleMutation = useMutation({
    mutationFn: async ({ 
      moduleName, 
      enabled 
    }: { 
      moduleName: string; 
      enabled: boolean 
    }) => {
      if (!effectiveOrgId) {
        throw new Error('No organization ID available');
      }
      
      return adminApi.toggleOrgModule(effectiveOrgId, moduleName, enabled);
    },
    onSuccess: async () => {
      console.log('[useOrg] Module toggled successfully, refreshing all module data');
      
      // Invalidate all related queries
      await queryClient.invalidateQueries({ queryKey: ['org', effectiveOrgId] });
      await queryClient.invalidateQueries({ queryKey: ['modules'] });
      
      // Explicitly refetch both org details and modules
      await Promise.all([
        refetch(),
        refetchModules()
      ]);
      
      toast({
        title: 'Module updated',
        description: 'Module settings have been updated successfully',
        variant: 'default'
      });
    },
    onError: (error: Error) => {
      console.error('[useOrg] Error toggling module:', error);
      toast({
        title: 'Failed to update module',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Toggle module function that uses the mutation
  const toggleModule = useCallback(async (moduleName: string, enabled: boolean) => {
    try {
      console.log(`[useOrg] Toggling module ${moduleName} to ${enabled ? 'enabled' : 'disabled'}`);
      await moduleMutation.mutateAsync({ moduleName, enabled });
      return true;
    } catch (error) {
      return false;
    }
  }, [moduleMutation]);

  // Force a refresh of both org and modules data
  const refreshOrgData = useCallback(async () => {
    console.log('[useOrg] Refreshing all organization data');
    
    // Invalidate both caches
    await queryClient.invalidateQueries({ queryKey: ['org', effectiveOrgId] });
    await queryClient.invalidateQueries({ queryKey: ['modules'] });
    
    // Refetch both data sources
    await Promise.all([
      refetch(),
      refetchModules()
    ]);
    
    console.log('[useOrg] Organization data refresh complete');
  }, [effectiveOrgId, queryClient, refetch, refetchModules]);

  return {
    org,
    enabledModules,
    isLoading,
    error,
    orgId: effectiveOrgId,
    toggleModule,
    refetchOrg: refreshOrgData,
    isToggling: moduleMutation.isPending
  };
};