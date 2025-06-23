declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
        tenantId: number;
        role: string;
        firstName?: string;
        lastName?: string;
        email?: string;
      };
      isAuthenticated?(): boolean;
    }
  }
}

export {}; 