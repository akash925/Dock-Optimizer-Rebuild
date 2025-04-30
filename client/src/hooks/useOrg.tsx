import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/queryClient';

interface OrgModule {
  moduleName: string;
  enabled: boolean;
}

interface Organization {
  id: number;
  name: string;
  modules: OrgModule[];
  // Add other org properties as needed
}

const fetchOrg = async (orgId: number): Promise<Organization> => {
  const res = await apiRequest('GET', `/api/admin/orgs/${orgId}/detail`);
  const data = await res.json();
  return data.organization || data;
};

export const useOrg = (orgId?: number) => {
  const { user } = useAuth();
  
  // If no orgId provided, use the user's tenantId (organization id)
  const effectiveOrgId = orgId || user?.tenantId;
  
  const { 
    data: org,
    isLoading,
    error
  } = useQuery({
    queryKey: ['org', effectiveOrgId],
    queryFn: () => fetchOrg(effectiveOrgId),
    enabled: !!effectiveOrgId,
    staleTime: 300000, // Cache for 5 minutes
  });

  // Extract module names that are enabled
  const enabledModules = useMemo(() => {
    const modules = org?.modules || [];
    // Map to just the module names of enabled modules
    return modules
      .filter(m => m.enabled)
      .map(m => m.moduleName);
  }, [org?.modules]);
  
  // Log for debugging purposes
  console.log('Organization:', org?.name);
  console.log('Enabled Modules:', enabledModules);

  return { 
    org, 
    enabledModules, 
    isLoading,
    error,
    orgId: effectiveOrgId
  };
};