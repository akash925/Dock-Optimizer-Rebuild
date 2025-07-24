declare module "express-serve-static-core" {
  interface Request {
    user?: {
      id: number;
      role: string;
      username: string;
      tenantId: number | null;
      email?: string;
      firstName?: string;
      lastName?: string;
    };
    isAuthenticated?: () => boolean;
  }
}

export interface AuthenticatedRequest extends Request {
  user: NonNullable<Request['user']>;
}

// Type guard helper
export function isAuthenticated(req: Request): req is AuthenticatedRequest {
  return req.isAuthenticated?.() === true && req.user != null;
}