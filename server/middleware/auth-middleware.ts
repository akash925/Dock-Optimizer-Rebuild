import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to check if a user is authenticated
 * If the user is not authenticated, the request is rejected with a 401 status
 */
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication required' 
    });
  }
  next();
}