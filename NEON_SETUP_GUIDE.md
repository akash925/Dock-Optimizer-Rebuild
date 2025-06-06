# Neon Database Setup for Dock Optimizer

## Why Neon + Replit is Perfect

✅ **Serverless PostgreSQL** - No server management needed  
✅ **Free Tier Available** - 0.5GB storage, 10GB transfer/month  
✅ **Works from Anywhere** - Perfect for Replit development  
✅ **Production Ready** - Scales automatically  
✅ **Already Configured** - App uses `@neondatabase/serverless`  

## Step 1: Create Neon Database

### 1.1 Sign Up for Neon
1. Go to **https://neon.tech**
2. Click "Sign Up" (can use GitHub account)
3. Create your account

### 1.2 Create Database
1. Click "Create Project"
2. **Project Name**: `dock-optimizer`
3. **Database Name**: `dockoptimizer` 
4. **Region**: Choose closest to your users (US East for most US traffic)
5. Click "Create Project"

### 1.3 Get Connection String
After project creation, you'll see the connection details:
- Copy the **Connection String** (it looks like this):
```
postgresql://username:password@ep-xyz123.us-east-1.aws.neon.tech/dockoptimizer?sslmode=require
```

## Step 2: Configure Your Application

### 2.1 Update .env File
Replace your current `.env` with:

```env
# Neon Database Configuration
DATABASE_URL=postgresql://your-username:your-password@ep-xyz123.us-east-1.aws.neon.tech/dockoptimizer?sslmode=require

# Email Configuration (for production)
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com

# Application Configuration
HOST_URL=https://yourdomain.com
NODE_ENV=development

# Optional: Enable query logging for development
DATABASE_DEBUG=true
```

### 2.2 For Replit Development
If you're developing in Replit, add these to your **Replit Secrets** (more secure):

1. Go to your Replit project
2. Click the "Secrets" tab (lock icon)
3. Add these secrets:
   - `DATABASE_URL`: Your full Neon connection string
   - `SENDGRID_API_KEY`: Your email service key
   - `HOST_URL`: Your app URL (can be your Replit app URL)

## Step 3: Run Database Migrations

### 3.1 Install Dependencies (if needed)
```bash
npm install
```

### 3.2 Push Database Schema
```bash
# This creates all tables in your Neon database
npm run db:push
```

### 3.3 Verify Connection
```bash
# Start the application
npm run dev
```

You should see:
```
✅ Server running on port 3000
✅ Database connected successfully
```

## Step 4: Production Deployment

### 4.1 Environment Variables for Production
When deploying to production (Railway, Vercel, etc.), set these environment variables:

```env
DATABASE_URL=your-neon-connection-string
SENDGRID_API_KEY=your-production-sendgrid-key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
HOST_URL=https://yourdomain.com
NODE_ENV=production
```

### 4.2 Connection Pooling (Optional)
For high-traffic production, Neon supports connection pooling:

```env
# Use pooled connection for production
DATABASE_URL=postgresql://username:password@ep-xyz123-pooler.us-east-1.aws.neon.tech/dockoptimizer?sslmode=require
```

## Step 5: Verify Everything Works

### 5.1 Test Database Connection
Create a simple test script:

```javascript
// test-neon-connection.js
import { Pool } from '@neondatabase/serverless';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function testConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('✅ Database connected successfully!');
    console.log('Current time:', result.rows[0].now);
    client.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  }
}

testConnection();
```

Run with: `node test-neon-connection.js`

### 5.2 Test Application Features
1. **Asset Manager** - Should load without errors
2. **Appointments** - Should create/view appointments
3. **Booking Pages** - External booking should work
4. **Admin Features** - All admin functionality should work

## Troubleshooting

### Common Issues

#### "connection to server was lost"
- **Cause**: Network connectivity or SSL issues
- **Fix**: Ensure connection string includes `?sslmode=require`

#### "too many connections"
- **Cause**: Connection pool exhaustion
- **Fix**: Use pooled connection string or reduce concurrent connections

#### "relation does not exist" 
- **Cause**: Database schema not created
- **Fix**: Run `npm run db:push` to create tables

#### "password authentication failed"
- **Cause**: Wrong credentials in connection string
- **Fix**: Double-check username/password from Neon dashboard

### Replit-Specific Issues

#### Environment Variables Not Loading
```bash
# In Replit, ensure you're using Secrets, not .env for sensitive data
# Access via process.env.DATABASE_URL (should work automatically)
```

#### SSL Certificate Issues
```bash
# If you get SSL errors, make sure your connection string includes:
# ?sslmode=require
```

## Monitoring and Maintenance

### 5.1 Neon Dashboard
Monitor your database usage at https://console.neon.tech:
- **Compute time** usage
- **Storage** usage  
- **Data transfer** usage
- **Query performance**

### 5.2 Free Tier Limits
- **Storage**: 0.5GB
- **Compute**: 750 hours/month
- **Data Transfer**: 10GB/month

For production, consider upgrading to paid plan.

## Security Best Practices

### 6.1 Connection String Security
- ✅ Use environment variables/secrets
- ❌ Never commit connection strings to git
- ✅ Use different databases for dev/staging/prod
- ✅ Rotate passwords regularly

### 6.2 Network Security
- ✅ Neon includes SSL by default
- ✅ IP allowlisting available on paid plans
- ✅ Connection pooling for better performance

## Next Steps

1. **✅ Set up Neon database** (follow steps above)
2. **✅ Update .env or Replit Secrets**
3. **✅ Run migrations**: `npm run db:push`
4. **✅ Test application**: `npm run dev`
5. **✅ Verify all features work**
6. **🚀 Deploy to production** with same Neon database

Your Dock Optimizer will now have a production-ready PostgreSQL database that works perfectly in both Replit development and production deployment! 