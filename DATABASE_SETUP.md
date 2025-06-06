# Database Setup Guide for Dock Optimizer

## Current Issue
The application is configured for **PostgreSQL** but was temporarily set up with SQLite, causing failures.

## Required Setup

### 1. Choose a PostgreSQL Provider

**For Production (Recommended):**
- **Neon** (https://neon.tech) - Serverless PostgreSQL, free tier available
- **Railway** (https://railway.app) - Easy deployment with PostgreSQL
- **Supabase** (https://supabase.com) - PostgreSQL with built-in features
- **AWS RDS** - Enterprise-grade PostgreSQL

**For Development:**
- Use the same provider as production for consistency
- OR local PostgreSQL with Docker

### 2. Database Configuration

#### Option A: Neon (Recommended for MVP)
1. Go to https://neon.tech
2. Create a free account
3. Create a new database
4. Copy the connection string

#### Option B: Local PostgreSQL with Docker
```bash
# Start PostgreSQL container
docker run --name dock-optimizer-db \
  -e POSTGRES_DB=dockoptimizer \
  -e POSTGRES_USER=dockuser \
  -e POSTGRES_PASSWORD=dockpass \
  -p 5432:5432 \
  -d postgres:15

# Connection string would be:
# postgresql://dockuser:dockpass@localhost:5432/dockoptimizer
```

### 3. Environment Configuration

Update your `.env` file with the actual connection string:

```env
# Replace with your actual PostgreSQL connection string
DATABASE_URL=postgresql://username:password@host:port/database

# Email configuration (required for production)
SENDGRID_API_KEY=your-actual-sendgrid-key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com

# Application URL
HOST_URL=https://yourdomain.com

# Development
NODE_ENV=development
```

### 4. Run Database Migrations

After setting up the database, run the migrations:

```bash
# Install dependencies
npm install

# Run database migrations
npm run db:migrate

# Or manually with drizzle
npx drizzle-kit migrate
```

### 5. Verify Setup

```bash
# Test database connection
npm run db:seed  # if available
# or
npm run dev     # should start without database errors
```

## Production Deployment Checklist

### Database Security
- [ ] Use connection pooling
- [ ] Enable SSL/TLS connections
- [ ] Set up database backups
- [ ] Configure connection limits
- [ ] Use environment-specific databases (dev/staging/prod)

### Environment Variables
- [ ] Set up production DATABASE_URL
- [ ] Configure email service (SendGrid)
- [ ] Set proper HOST_URL
- [ ] Configure other required secrets

### Monitoring
- [ ] Set up database monitoring
- [ ] Configure error tracking
- [ ] Set up health checks
- [ ] Monitor connection pool usage

## Troubleshooting

### "DATABASE_URL must be set" Error
1. Ensure `.env` file exists in project root
2. Verify DATABASE_URL format: `postgresql://user:pass@host:port/db`
3. Test connection string manually

### Migration Failures
1. Check if database exists and is accessible
2. Verify user has necessary permissions
3. Run migrations one by one if needed

### Connection Issues
1. Check firewall settings
2. Verify SSL requirements
3. Test with a simple PostgreSQL client first

## Next Steps

1. **Immediate**: Set up a development database (Neon free tier)
2. **Before Production**: Set up production database with proper security
3. **Ongoing**: Monitor database performance and optimize queries

## Database Schema

The application uses Drizzle ORM with the following key tables:
- `companies` - Multi-tenant organization data
- `facilities` - Dock/facility information
- `appointments` - Scheduling data
- `booking_pages` - External booking configuration
- `assets` - File/document management

All migrations are in the `/migrations` directory and should be run in order. 