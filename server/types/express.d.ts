import type { Request, Response, NextFunction } from 'express';
declare module "express-serve-static-core" {
  interface Request {
    // Standard Express properties
    params: any;
    query: any;
    body: any;
    headers: any;
    
    // Passport authentication properties
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
    logout?: (callback?: (err: any) => void) => void;
  }
}

export interface AuthenticatedRequest extends Request {
  user: NonNullable<Request['user']>;
}

// Type guard helper
export function isAuthenticated(req: Request): req is AuthenticatedRequest {
  return req.isAuthenticated?.() === true && req.user != null;
}