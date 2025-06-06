# Debugging Replit Deployment Issues

## 🔍 **Current Issues Identified:**

### 1. Asset Manager API Failure
- **Error**: "Failed to load company assets. Please try again."
- **Likely Cause**: Database connection, API endpoint, or query issue
- **Status**: Under investigation

### 2. WebSocket Connection Errors  
- **Error**: `wss://localhost:undefined/?token=...` invalid URL
- **Cause**: WebSocket URL construction failing in Replit environment
- **Fix**: ✅ Applied - Enhanced host detection for Replit

### 3. Possible Cache Issues
- **Issue**: Application may be running from old cached build
- **Symptoms**: Changes not reflecting, old error patterns persisting

## 🛠️ **Debugging Steps for Replit:**

### Step 1: Force Replit Rebuild
```bash
# In Replit console
npm run build
# or
rm -rf node_modules/.vite && npm run dev
```

### Step 2: Check Environment Variables
```bash
# Verify database connection
echo $DATABASE_URL
# Should show your Neon connection string
```

### Step 3: Test API Endpoints Directly
```bash
# Test basic API health
curl https://your-replit-url.replit.dev/api/test

# Test database connection
curl https://your-replit-url.replit.dev/api/test/db-connection

# Test company assets
curl https://your-replit-url.replit.dev/api/test/company-assets
```

### Step 4: Check Database Schema
```bash
# Verify schema is up to date
npm run db:push
```

### Step 5: Clear Browser Cache
- Hard refresh: `Ctrl+Shift+R` (Chrome/Firefox)
- Clear site data in DevTools > Application > Storage

## 🎯 **Expected Working State:**

### ✅ **What Should Work:**
1. **Asset Manager**: Load empty list (no error message)
2. **WebSocket**: Connect to `wss://your-replit-url.replit.dev/ws`
3. **Database**: Neon PostgreSQL queries executing
4. **API Health**: `/api/test` returns OK status

### ❌ **Current Failing:**
1. Asset Manager showing "Failed to load" error
2. WebSocket trying to connect to invalid localhost URL
3. Browser console showing React component warnings

## 🔧 **Quick Fixes to Try:**

### 1. Force Application Restart in Replit
- Stop the current run
- Clear cache: `rm -rf .replit`
- Restart with `npm run dev`

### 2. Database Schema Sync
```bash
npm run db:push
```

### 3. Environment Check
```bash
node -e "console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET')"
```

### 4. Manual API Test
Create a simple test in Replit console:
```bash
curl -X GET "https://$(echo $REPL_SLUG)-$(echo $REPL_OWNER).repl.co/api/asset-manager/company-assets" \
  -H "Accept: application/json"
```

## 📋 **Diagnosis Checklist:**

- [ ] Replit environment variables are set
- [ ] Database schema is synchronized
- [ ] API endpoints respond to curl tests
- [ ] WebSocket URL construction is fixed
- [ ] Frontend cache is cleared
- [ ] Application restarts without errors

## 🚀 **Recovery Steps:**

If issues persist:

1. **Full Rebuild**:
   ```bash
   rm -rf node_modules
   rm -rf .next
   rm -rf dist
   npm install
   npm run db:push
   npm run dev
   ```

2. **Environment Reset**:
   - Check Replit Secrets panel
   - Ensure all environment variables are properly set
   - Restart the Repl

3. **Database Verification**:
   ```bash
   node test-neon-connection.js
   ```

## 📞 **Next Steps:**

1. Try the WebSocket fix (already applied)
2. Test API endpoints with debug routes
3. Force rebuild if cache issues suspected
4. Verify database connectivity with new schema 