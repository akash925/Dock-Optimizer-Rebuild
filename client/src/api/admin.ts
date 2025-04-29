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

export interface UserWithMemberships {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  memberships: {
    orgId: number;
    orgName: string;
    roleName: string;
  }[];
}

export interface CreateUserData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface UpdateUserOrgData {
  orgId: number;
  roleName: string;
  action: 'add' | 'remove';
}

export interface CreateOrgData {
  name: string;
  subdomain: string;
  status?: string;
}

/**
 * Admin API client
 */
const adminApi = {
  /**
   * Get organization list
   */
  async getOrganizations(page: number = 1, limit: number = 20) {
    const res = await apiRequest("GET", `/api/admin/orgs?page=${page}&limit=${limit}`);
    const data = await res.json();
    // Return the organizations array, unwrapping from "orgs" if present
    return data.orgs ?? data;
  },
  
  /**
   * Create a new organization
   */
  async createOrg(data: CreateOrgData) {
    const res = await apiRequest("POST", "/api/admin/orgs", data);
    return await res.json();
  },

  /**
   * Get organization detail with users, modules, and logs
   */
  async getOrgDetail(orgId: string | number): Promise<OrganizationDetail> {
    const res = await apiRequest("GET", `/api/admin/orgs/${orgId}/detail`);
    const data = await res.json();
    // Return the organization object, unwrapping from "organization" if present
    return data.organization ?? data;
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
   * Get all users with their organization memberships
   */
  async getUsers(page: number = 1, limit: number = 100) {
    const res = await apiRequest("GET", `/api/admin/users?page=${page}&limit=${limit}`);
    const data = await res.json();
    // Return only the users array from the response
    return Array.isArray(data) ? data : 
           (data && data.items && Array.isArray(data.items)) ? data.items.rows || data.items : [];
  },
  
  /**
   * Get a specific user with their organization memberships
   */
  async getUserDetail(userId: string | number): Promise<UserWithMemberships> {
    const res = await apiRequest("GET", `/api/admin/users/${userId}`);
    return await res.json();
  },
  
  /**
   * Create a new user
   */
  async createUser(data: CreateUserData) {
    const res = await apiRequest("POST", "/api/admin/users", data);
    return await res.json();
  },
  
  /**
   * Update user organization membership
   */
  async updateUserOrg(userId: string | number, data: UpdateUserOrgData) {
    const res = await apiRequest("PUT", `/api/admin/users/${userId}/orgs`, data);
    return await res.json();
  },

  /**
   * Get all roles
   */
  async getRoles() {
    const res = await apiRequest("GET", "/api/admin/settings/roles");
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  },
  
  /**
   * Get all roles (alias for settings page)
   */
  async getAllRoles() {
    const res = await apiRequest("GET", "/api/admin/settings/roles");
    const data = await res.json();
    // Return the roles array, unwrapping from "roles" if present
    return data.roles ?? data;
  },
  
  /**
   * Update a role
   */
  async updateRole(roleId: number, data: { name: string, description?: string }) {
    const res = await apiRequest("PUT", `/api/admin/settings/roles/${roleId}`, data);
    return await res.json();
  }
};

export default adminApi;