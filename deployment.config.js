/**
 * Deployment Configuration for Replit Autoscale
 * This file provides deployment-specific configuration and environment setup
 */

module.exports = {
  deployment: {
    target: 'autoscale',
    build: {
      command: 'node build-production.cjs',
      outputDir: 'dist',
      timeout: 600 // 10 minutes
    },
    runtime: {
      command: 'doppler run --config prd -- node server/index.js',
      port: process.env.PORT || 5001,
      healthcheck: '/api/health'
    },
    environment: {
      NODE_ENV: 'production',
      PORT: process.env.PORT || '5001',
      // Doppler config
      DOPPLER_PROJECT: process.env.DOPPLER_PROJECT || 'dock-optimizer',
      DOPPLER_CONFIG: process.env.DOPPLER_CONFIG || 'prd'
    },
    secrets: [
      'DATABASE_URL',
      'SENDGRID_API_KEY', 
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
      'AWS_S3_BUCKET',
      'REDIS_URL',
      'SESSION_SECRET',
      'DOPPLER_TOKEN'
    ]
  }
};