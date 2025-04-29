import { apiRequest } from "@/lib/queryClient";

// Types
interface OrgUser {
  userId: number;
  email: string;
  firstName: string;
  lastName: string;
  roleName: string;
}

interface OrgModule {
  moduleName: string;
  enabled: boolean;
}

interface ActivityLog {
  id: number;
  timestamp: string;
  action: string;
  details: string;
}

export interface OrganizationDetail {
  id: number;
  name: string;
  subdomain: string;
  status: string;
  createdAt: string;
  primaryContact: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  users: OrgUser[];
  modules: OrgModule[];
  logs: ActivityLog[];
}

/**
 * Admin API client
 */
const adminApi = {
  /**
   * Get organization list
   */
  async getOrganizations() {
    const res = await apiRequest("GET", "/api/admin/organizations");
    return await res.json();
  },

  /**
   * Get organization detail with users, modules, and logs
   */
  async getOrgDetail(orgId: string | number): Promise<OrganizationDetail> {
    const res = await apiRequest("GET", `/api/admin/orgs/${orgId}/detail`);
    return await res.json();
  },

  /**
   * Toggle a module for an organization
   */
  async toggleOrgModule(orgId: string | number, moduleName: string, enabled: boolean) {
    const res = await apiRequest("PUT", `/api/admin/orgs/${orgId}/modules`, {
      moduleName,
      enabled
    });
    return await res.json();
  },

  /**
   * Add a user to an organization
   */
  async addUserToOrg(orgId: string | number, userId: number, roleId: number) {
    const res = await apiRequest("PUT", `/api/admin/orgs/${orgId}/users`, {
      userId,
      roleId,
      action: "add"
    });
    return await res.json();
  },

  /**
   * Remove a user from an organization
   */
  async removeUserFromOrg(orgId: string | number, userId: number) {
    const res = await apiRequest("PUT", `/api/admin/orgs/${orgId}/users`, {
      userId,
      action: "remove"
    });
    return await res.json();
  },

  /**
   * Get organization activity logs with pagination
   */
  async getOrgLogs(orgId: string | number, page: number = 1) {
    const res = await apiRequest("GET", `/api/admin/orgs/${orgId}/logs?page=${page}`);
    return await res.json();
  },

  /**
   * Get all users with pagination
   */
  async getUsers(page: number = 1, limit: number = 20) {
    const res = await apiRequest("GET", `/api/admin/users?page=${page}&limit=${limit}`);
    return await res.json();
  },

  /**
   * Get all roles
   */
  async getRoles() {
    const res = await apiRequest("GET", "/api/admin/roles");
    return await res.json();
  }
};

export default adminApi;