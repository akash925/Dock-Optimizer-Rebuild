import { useMemo, useCallback, useRef } from 'react';
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
        const response = await apiRequest(
          'PUT', 
          `/api/admin/orgs/${orgId}/modules/${moduleName}?_t=${timestamp}`,
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

const fetchOrg = async (orgId: number): Promise<Organization | null> => {
  if (!orgId) return null;
  
  try {
    // Add a cache-busting timestamp
    const timestamp = new Date().getTime();
    const res = await apiRequest('GET', `/api/admin/orgs/${orgId}/detail?_t=${timestamp}`, undefined, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
    if (!res.ok) {
      if (res.status === 404) {
        return null; // Organization not found
      }
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
    staleTime: 300000, // 5 minutes
    gcTime: 600000, // 10 minutes
    refetchOnWindowFocus: false,
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
      .filter(m => m.enabled)
      .map(m => m.moduleName);
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
      // Invalidate all related queries
      await queryClient.invalidateQueries({ queryKey: ['org', effectiveOrgId] });
      await queryClient.invalidateQueries({ queryKey: ['modules'] });
      
      // Explicitly refetch data
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
      console.error('Error toggling module:', error);
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
      await moduleMutation.mutateAsync({ moduleName, enabled });
      return true;
    } catch (error) {
      return false;
    }
  }, [moduleMutation]);

  // Force a refresh of both org and modules data
  const refreshOrgData = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['org', effectiveOrgId] }),
      queryClient.invalidateQueries({ queryKey: ['modules'] }),
      refetch(),
      refetchModules()
    ]);
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