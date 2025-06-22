import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to detect and log environment information for debugging
 * Helps identify Replit, localhost, and production environments
 */
export const environmentCheck = (req: Request, res: Response, next: NextFunction) => {
  // Only log on the first request or periodically
  if (!global.environmentLogged) {
    const hostname = req.hostname;
    const userAgent = req.get('User-Agent') || '';
    const forwardedHost = req.get('x-forwarded-host') || '';
    
    console.log('[ENV] Environment Detection:');
    console.log(`[ENV] - Hostname: ${hostname}`);
    console.log(`[ENV] - X-Forwarded-Host: ${forwardedHost}`);
    console.log(`[ENV] - User-Agent: ${userAgent}`);
    console.log(`[ENV] - NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`[ENV] - REPL_ID: ${process.env.REPL_ID ? 'Present' : 'Not set'}`);
    console.log(`[ENV] - DATABASE_URL: ${process.env.DATABASE_URL ? 'Present' : 'Not set'}`);
    
    // Detect environment type
    let envType = 'unknown';
    if (hostname.includes('replit.dev') || hostname.includes('replit.co') || process.env.REPL_ID) {
      envType = 'replit';
    } else if (hostname === 'localhost' || hostname.startsWith('127.')) {
      envType = 'local-development';
    } else if (hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
      envType = 'ip-address';
    } else if (process.env.NODE_ENV === 'production') {
      envType = 'production';
    }
    
    console.log(`[ENV] - Detected Environment: ${envType}`);
    
    // Mark as logged
    global.environmentLogged = true;
  }
  
  next();
};

// Type declaration for global variable
declare global {
  var environmentLogged: boolean | undefined;
} 