/**
 * Health Check Endpoint for Deployment Monitoring
 * Provides comprehensive application health status
 */

import { Router, Request, Response } from 'express';
import { getHealthStatus } from '../config/environment.js';

const router = Router();

// Health check endpoint for deployment monitoring
router.get('/health', (req: Request, res: Response) => {
  try {
    const healthStatus = getHealthStatus();
    
    // Return appropriate HTTP status based on health
    const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json({
      ...healthStatus,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Simple readiness probe
router.get('/ready', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ready',
    timestamp: new Date().toISOString()
  });
});

// Simple liveness probe
router.get('/alive', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString()
  });
});

export default router;