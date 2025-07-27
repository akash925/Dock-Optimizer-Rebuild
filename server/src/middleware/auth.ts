import { Request, Response, NextFunction } from 'express';

// @ts-expect-error: AuthenticatedRequest interface extension mismatch
export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
    tenantId: number;
    role: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  };
  isAuthenticated(): boolean;
}

export enum UserRole {
  WORKER = 'worker',
  MANAGER = 'manager', 
  ADMIN = 'admin',
  SUPER_ADMIN = 'super-admin'
}

export enum Permission {
  // User management
  CREATE_USERS = 'create_users',
  VIEW_USERS = 'view_users',
  EDIT_USERS = 'edit_users',
  DELETE_USERS = 'delete_users',
  
  // Organization management
  CREATE_ORGANIZATIONS = 'create_organizations',
  VIEW_ORGANIZATIONS = 'view_organizations',
  EDIT_ORGANIZATIONS = 'edit_organizations',
  DELETE_ORGANIZATIONS = 'delete_organizations',
  
  // Facility management
  CREATE_FACILITIES = 'create_facilities',
  VIEW_FACILITIES = 'view_facilities',
  EDIT_FACILITIES = 'edit_facilities',
  DELETE_FACILITIES = 'delete_facilities',
  
  // Appointment management
  CREATE_APPOINTMENTS = 'create_appointments',
  VIEW_APPOINTMENTS = 'view_appointments',
  EDIT_APPOINTMENTS = 'edit_appointments',
  DELETE_APPOINTMENTS = 'delete_appointments',
  
  // Analytics and reports
  VIEW_ANALYTICS = 'view_analytics',
  CREATE_SAMPLE_DATA = 'create_sample_data',
  
  // System administration
  MANAGE_MODULES = 'manage_modules',
  VIEW_SYSTEM_LOGS = 'view_system_logs'
}

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.WORKER]: [
    Permission.VIEW_APPOINTMENTS,
    Permission.CREATE_APPOINTMENTS,
    Permission.EDIT_APPOINTMENTS
  ],
  [UserRole.MANAGER]: [
    Permission.VIEW_APPOINTMENTS,
    Permission.CREATE_APPOINTMENTS,
    Permission.EDIT_APPOINTMENTS,
    Permission.DELETE_APPOINTMENTS,
    Permission.VIEW_FACILITIES,
    Permission.VIEW_ANALYTICS
  ],
  [UserRole.ADMIN]: [
    Permission.CREATE_USERS,
    Permission.VIEW_USERS,
    Permission.EDIT_USERS,
    Permission.DELETE_USERS,
    Permission.CREATE_FACILITIES,
    Permission.VIEW_FACILITIES,
    Permission.EDIT_FACILITIES,
    Permission.DELETE_FACILITIES,
    Permission.CREATE_APPOINTMENTS,
    Permission.VIEW_APPOINTMENTS,
    Permission.EDIT_APPOINTMENTS,
    Permission.DELETE_APPOINTMENTS,
    Permission.VIEW_ANALYTICS,
    Permission.CREATE_SAMPLE_DATA,
    Permission.MANAGE_MODULES
  ],
  [UserRole.SUPER_ADMIN]: [
    ...Object.values(Permission) // Super admin has all permissions
  ]
};

export class AuthService {
  static requireAuth() {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      next();
    };
  }

  static requirePermission(...permissions: Permission[]) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const user = req.user!;
      const userRole = user.role as UserRole;
      const userPermissions = ROLE_PERMISSIONS[userRole] || [];

      const hasPermission = permissions.some(permission => 
        userPermissions.includes(permission)
      );

      if (!hasPermission) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          required: permissions,
          userRole: userRole
        });
      }

      next();
    };
  }

  static requireRole(...roles: UserRole[]) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const user = req.user!;
      if (!roles.includes(user.role as UserRole)) {
        return res.status(403).json({ 
          error: 'Insufficient role access',
          required: roles,
          userRole: user.role
        });
      }

      next();
    };
  }

  static requireAdminLevel() {
    return AuthService.requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN);
  }

  static hasPermission(userRole: string, permission: Permission): boolean {
    const rolePermissions = ROLE_PERMISSIONS[userRole as UserRole] || [];
    return rolePermissions.includes(permission);
  }
} 