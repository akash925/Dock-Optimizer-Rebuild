declare module "express-serve-static-core" {
  interface Request {
    user?: {
      id: number;
      role?: string;
      username?: string;
      tenantId?: number | null;
      email?: string;
      firstName?: string;
      lastName?: string;
    };
    isAuthenticated?: () => boolean;
  }
}

declare module "express" {
  export interface AuthenticatedRequest extends Request {
    user: NonNullable<Request['user']>;
  }
} 