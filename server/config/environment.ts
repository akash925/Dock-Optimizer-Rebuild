/**
 * Environment Configuration with Doppler Integration and Fallbacks
 * Handles production deployment with proper secret management
 */

import dotenv from 'dotenv';

// Load environment variables with fallback support
function loadEnvironment() {
  try {
    // Try to load .env file for development
    dotenv.config();
  } catch (error) {
    console.warn('No .env file found, using environment variables');
  }

  // Check if Doppler is available
  const isDopplerAvailable = process.env.DOPPLER_TOKEN || process.env.DOPPLER_PROJECT;
  
  if (isDopplerAvailable) {
    console.log('✅ Doppler configuration detected');
  } else {
    console.log('⚠️ Doppler not configured, using direct environment variables');
  }

  return {
    isDopplerAvailable,
    environment: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '5001', 10),
    
    // Database configuration
    database: {
      url: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    },

    // Email configuration
    email: {
      apiKey: process.env.SENDGRID_API_KEY,
      fromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@dockoptimizer.com'
    },

    // AWS S3 configuration
    aws: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      bucket: process.env.AWS_S3_BUCKET,
      region: process.env.AWS_REGION || 'us-east-1'
    },

    // Redis configuration
    redis: {
      url: process.env.REDIS_URL,
      enabled: Boolean(process.env.REDIS_URL)
    },

    // Session configuration
    session: {
      secret: process.env.SESSION_SECRET || 'dock-optimizer-fallback-secret-change-in-production',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    },

    // Application configuration
    app: {
      baseUrl: process.env.BASE_URL || 'https://dock-optimizer.replit.app',
      logLevel: process.env.LOG_LEVEL || 'info'
    }
  };
}

export const config = loadEnvironment();

// Validation function for critical environment variables
export function validateEnvironment() {
  const criticalVars = [
    'DATABASE_URL',
    'SENDGRID_API_KEY'
  ];

  const missing = criticalVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.error('❌ Missing critical environment variables:', missing.join(', '));
    
    if (process.env.NODE_ENV === 'production') {
      console.error('🚨 Production deployment requires all critical environment variables');
      throw new Error(`Missing critical environment variables: ${missing.join(', ')}`);
    } else {
      console.warn('⚠️ Development mode: some features may not work without proper configuration');
    }
  }

  const optional = [
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY', 
    'AWS_S3_BUCKET',
    'REDIS_URL'
  ];

  const missingOptional = optional.filter(varName => !process.env[varName]);
  if (missingOptional.length > 0) {
    console.warn('⚠️ Optional environment variables not set:', missingOptional.join(', '));
  }

  return {
    isValid: missing.length === 0,
    missing,
    missingOptional
  };
}

// Health check endpoint data
export function getHealthStatus() {
  const validation = validateEnvironment();
  
  return {
    status: validation.isValid ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    environment: config.environment,
    port: config.port,
    doppler: config.isDopplerAvailable,
    services: {
      database: Boolean(config.database.url),
      email: Boolean(config.email.apiKey),
      aws: Boolean(config.aws.accessKeyId && config.aws.secretAccessKey),
      redis: config.redis.enabled
    },
    missing: validation.missing,
    missingOptional: validation.missingOptional
  };
}