import { Request, Response, NextFunction } from 'express';

// Rate limiting protection state
let rateLimitActive = false;
let rateLimitStartTime = 0;
const RATE_LIMIT_COOLDOWN = 30000; // 30 seconds

// Track recent errors to detect rate limiting patterns
const recentErrors: Array<{ time: number; code: string }> = [];
const ERROR_WINDOW = 60000; // 1 minute window
const ERROR_THRESHOLD = 5; // 5 rate limit errors in 1 minute triggers protection

/**
 * Middleware to protect against database rate limiting
 * Temporarily pauses non-essential requests when rate limits are detected
 */
export const rateLimitProtection = (req: Request, res: Response, next: NextFunction) => {
  // Clean old errors
  const now = Date.now();
  while (recentErrors.length > 0 && recentErrors[0].time < now - ERROR_WINDOW) {
    recentErrors.shift();
  }
  
  // Check if rate limit protection is active
  if (rateLimitActive) {
    const timeSinceStart = now - rateLimitStartTime;
    
    // If cooldown period has passed, deactivate protection
    if (timeSinceStart > RATE_LIMIT_COOLDOWN) {
      rateLimitActive = false;
      console.log('[RATE-LIMIT] Protection deactivated after cooldown');
    } else {
      // For non-essential requests during rate limiting, return cached response
      if (isNonEssentialRequest(req)) {
        return res.status(503).json({
          error: 'Service temporarily unavailable due to high load',
          retryAfter: Math.ceil((RATE_LIMIT_COOLDOWN - timeSinceStart) / 1000)
        });
      }
    }
  }
  
  next();
};

/**
 * Call this when a rate limit error is detected
 */
export const reportRateLimitError = (error: any) => {
  const now = Date.now();
  
  if (error.code === 'XX000' && error.message?.includes('rate limit')) {
    recentErrors.push({ time: now, code: error.code });
    
    // Check if we've hit the threshold
    const recentRateLimitErrors = recentErrors.filter(e => e.code === 'XX000');
    
    if (recentRateLimitErrors.length >= ERROR_THRESHOLD && !rateLimitActive) {
      rateLimitActive = true;
      rateLimitStartTime = now;
      console.log(`[RATE-LIMIT] Protection activated due to ${recentRateLimitErrors.length} rate limit errors`);
    }
  }
};

/**
 * Determine if a request is non-essential and can be delayed during rate limiting
 */
function isNonEssentialRequest(req: Request): boolean {
  const path = req.path;
  const method = req.method;
  
  // Essential paths that should always work
  const essentialPaths = [
    '/api/auth',
    '/api/health',
    '/api/status',
    '/',
    '/login',
    '/dashboard'
  ];
  
  // Check if it's an essential path
  if (essentialPaths.some(essentialPath => path.startsWith(essentialPath))) {
    return false;
  }
  
  // Non-essential: API polling, analytics, non-critical assets
  if (path.includes('/api/analytics') ||
      path.includes('/api/notifications') ||
      path.includes('/api/activity') ||
      (method === 'GET' && path.includes('/api/')) ||
      path.includes('/assets/')) {
    return true;
  }
  
  return false;
}

/**
 * Get current rate limit protection status
 */
export const getRateLimitStatus = () => ({
  active: rateLimitActive,
  startTime: rateLimitStartTime,
  recentErrors: recentErrors.length,
  cooldownRemaining: rateLimitActive ? 
    Math.max(0, RATE_LIMIT_COOLDOWN - (Date.now() - rateLimitStartTime)) : 0
}); 