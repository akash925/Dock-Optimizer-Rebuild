#!/usr/bin/env node

/**
 * Production startup script for Dock Optimizer
 * Handles environment validation and graceful startup
 */

console.log('🚀 Starting Dock Optimizer in production mode...');
console.log('📋 Node version:', process.version);
console.log('📋 Platform:', process.platform);
console.log('📋 Architecture:', process.arch);

// Check if we're running with Doppler
if (process.env.DOPPLER_PROJECT) {
  console.log('✅ Doppler configuration detected:', process.env.DOPPLER_PROJECT);
  console.log('📋 Doppler config:', process.env.DOPPLER_CONFIG || 'default');
} else {
  console.warn('⚠️ Doppler not detected, using direct environment variables');
}

// Validate critical environment variables
const criticalVars = ['DATABASE_URL', 'SENDGRID_API_KEY'];
const missing = criticalVars.filter(varName => !process.env[varName]);

if (missing.length > 0) {
  console.error('❌ Missing critical environment variables:', missing.join(', '));
  console.error('🔧 Please ensure these are set in your deployment environment');
  process.exit(1);
}

// Set production defaults
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.PORT = process.env.PORT || '5001';

console.log('✅ Environment validation passed');
console.log('📡 Starting server on port:', process.env.PORT);

// Start the application
try {
  require('./server/index.js');
} catch (error) {
  console.error('❌ Failed to start server:', error.message);
  console.error('📋 Stack trace:', error.stack);
  process.exit(1);
}