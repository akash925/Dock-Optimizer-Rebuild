# Doppler Setup Guide for Dock Optimizer

## Overview

This guide covers the complete setup of Doppler for secure secret management in the Dock Optimizer application. Doppler provides centralized configuration management with automatic secret injection.

## Prerequisites

- Doppler CLI installed (automatically available in Replit Nix environment)
- Doppler account with project access
- Required secrets configured in Doppler dashboard

## Required Secrets

### Essential Secrets (Application won't start without these)

```bash
# Database
DATABASE_URL="postgresql://username:password@host:port/database?sslmode=require"

# Session Security
SESSION_SECRET="your-session-secret-key"

# Email Service
SENDGRID_API_KEY="SG.your-sendgrid-api-key"
SENDGRID_FROM_EMAIL="noreply@yourdomain.com"
```

### Optional Secrets (Graceful fallback available)

```bash
# Redis (Optional - Application works without Redis)
REDIS_URL="redis://localhost:6379"
BULLMQ_REDIS_URL="redis://localhost:6379"

# AWS S3 (Optional - Falls back to local storage)
AWS_S3_BUCKET="dock-optimizer-prod"
AWS_ACCESS_KEY_ID="your-access-key-id"
AWS_SECRET_ACCESS_KEY="your-secret-access-key"
AWS_REGION="us-east-1"

# JWT (Optional - For API authentication)
JWT_SECRET="your-jwt-secret"
JWT_PRIVATE_KEY="your-jwt-private-key"
```

## Replit Setup

### 1. Configure Replit Secrets

In your Replit project, go to the **Secrets** tab and add:

```
Name: DOPPLER_TOKEN
Value: your-doppler-service-token

Name: DOPPLER_PROJECT  
Value: dock-optimizer

Name: DOPPLER_CONFIG
Value: dev
```

### 2. Verify Configuration

The application automatically detects Doppler configuration. Check the console for:

```
[Doppler] ✅ Doppler CLI available
[Doppler] ✅ Project: dock-optimizer
[Doppler] ✅ Config: dev
[Doppler] ✅ Secrets loaded successfully
```

## Doppler CLI Usage

### Local Development

```bash
# Setup Doppler (one-time)
doppler setup --no-interactive --token $DOPPLER_TOKEN --project dock-optimizer --config dev

# Run application with Doppler
doppler run --config dev -- pnpm dev

# Check current configuration
doppler secrets
```

### Production Deployment

```bash
# Production configuration
doppler run --config prd -- pnpm start

# Verify production secrets
doppler secrets --config prd
```

## Environment Configurations

### Development (dev)
- Used for local development
- Contains non-sensitive test data
- Redis optional (local Redis or disabled)

### Staging (stg)
- Used for staging environment
- Contains staging database and services
- All services enabled for testing

### Production (prd)
- Used for production deployment
- Contains production secrets
- All services enabled and optimized

## Secret Management Best Practices

### ✅ Correct Approach

```bash
# Use Doppler CLI to set secrets
doppler secrets set DATABASE_URL="postgresql://..." --config prd

# Run application with Doppler
doppler run --config prd -- pnpm start

# Environment-specific secrets
doppler secrets set REDIS_URL="redis://prod-redis:6379" --config prd
doppler secrets set REDIS_URL="redis://localhost:6379" --config dev
```

### ❌ Avoid These Approaches

```bash
# Don't set environment variables manually
export DATABASE_URL="postgresql://..."

# Don't use .env files for production
echo "DATABASE_URL=..." > .env

# Don't hardcode secrets in code
const dbUrl = "postgresql://hardcoded-url"
```

## Redis Configuration

### Cloud Redis (Production)

```bash
# Upstash Redis
doppler secrets set REDIS_URL="redis://default:password@hostname:port" --config prd

# Redis Cloud
doppler secrets set REDIS_URL="rediss://default:password@hostname:port" --config prd
```

### Local Redis (Development)

```bash
# Local Redis with Docker
doppler secrets set REDIS_URL="redis://localhost:6379" --config dev

# Or leave unset to disable Redis
doppler secrets unset REDIS_URL --config dev
```

## Troubleshooting

### Common Issues

#### "Doppler CLI not found"
```bash
# Verify Doppler is installed
which doppler

# Check Nix packages
nix-env -q | grep doppler
```

#### "Invalid token"
```bash
# Check token in Replit Secrets
echo $DOPPLER_TOKEN

# Verify token permissions in Doppler dashboard
doppler me
```

#### "Project not found"
```bash
# List available projects
doppler projects

# Check project name in Replit Secrets
echo $DOPPLER_PROJECT
```

### Debug Commands

```bash
# Check Doppler status
doppler configure

# List all secrets (masked)
doppler secrets

# Test secret injection
doppler run --config dev -- env | grep DATABASE_URL

# Verify application startup
doppler run --config dev -- pnpm dev
```

## Health Checks

### Application Health

The application includes built-in health checks:

```bash
# Check database connection
curl http://localhost:5001/api/health/database

# Check Redis connection
curl http://localhost:5001/api/health/redis

# Check overall health
curl http://localhost:5001/api/health
```

### Expected Responses

```json
{
  "status": "healthy",
  "database": "connected",
  "redis": "connected", // or "disabled"
  "version": "1.0.0"
}
```

## Migration from .env

### 1. Export existing secrets

```bash
# Export from .env file
cat .env | grep -v '^#' | grep '=' > secrets.txt
```

### 2. Import to Doppler

```bash
# Import secrets to Doppler
while IFS='=' read -r key value; do
  doppler secrets set "$key"="$value" --config dev
done < secrets.txt
```

### 3. Verify migration

```bash
# Check secrets in Doppler
doppler secrets

# Test application startup
doppler run --config dev -- pnpm dev
```

### 4. Clean up

```bash
# Remove local .env file
rm .env secrets.txt
```

## Security Considerations

### Token Security
- Use read-only tokens for development
- Rotate tokens regularly
- Never commit tokens to version control

### Environment Isolation
- Use separate configs for dev/staging/prod
- Limit access to production secrets
- Audit secret access regularly

### Network Security
- Use TLS for all external services
- Restrict Redis access to application servers
- Monitor secret usage and access

## Replit Deployment

### Automatic Deployment

The `.replit` file is configured to automatically use Doppler:

```toml
run = "doppler run --config prd -- pnpm start"
```

### Manual Deployment

```bash
# Build for production
doppler run --config prd -- pnpm build

# Start production server
doppler run --config prd -- pnpm start
```

## Support

For additional help:
- Check Doppler documentation: https://docs.doppler.com
- Review application logs for specific errors
- Contact the development team for project-specific issues