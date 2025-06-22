# Vite 5 Migration Summary

## Overview
This document summarizes the migration from Node.js `process.env` usage to Vite 5-compatible `import.meta.env` for client-side code.

## Changes Made

### 1. Client-Side Environment Variables
- **Before**: `process.env.NODE_ENV === 'development'` 
- **After**: `import.meta.env.MODE === 'development'`

All client-side references to `process.env.NODE_ENV` have been replaced with `import.meta.env.MODE`.

### 2. Shared Schema Environment Helper
Created a new `shared/env-helper.ts` file that:
- Detects server vs. client context
- Uses `process.env` on server-side
- Uses `import.meta.env.VITE_*` on client-side
- Provides consistent interface for both environments

### 3. Environment Variable Structure
For database schema defaults, environment variables are now handled consistently:

**Server-side (process.env):**
```bash
DEFAULT_START_TIME=08:00
DEFAULT_END_TIME=17:00
DEFAULT_BREAK_START=12:00
DEFAULT_BREAK_END=13:00
DEFAULT_BUFFER_TIME=0
DEFAULT_GRACE_PERIOD=15
DEFAULT_EMAIL_REMINDER_HOURS=24
DEFAULT_MAX_CONCURRENT=1
DEFAULT_FACILITY_TIMEZONE=America/New_York
```

**Client-side (import.meta.env):**
```bash
VITE_DEFAULT_START_TIME=08:00
VITE_DEFAULT_END_TIME=17:00
VITE_DEFAULT_BREAK_START=12:00
VITE_DEFAULT_BREAK_END=13:00
VITE_DEFAULT_BUFFER_TIME=0
VITE_DEFAULT_GRACE_PERIOD=15
VITE_DEFAULT_EMAIL_REMINDER_HOURS=24
VITE_DEFAULT_MAX_CONCURRENT=1
VITE_DEFAULT_FACILITY_TIMEZONE=America/New_York
```

### 4. Vite Configuration Updates
- Added `vite-plugin-node-polyfills` for third-party library compatibility
- Improved HMR configuration for Replit environments
- Tree-shaking of polyfills in production builds

### 5. ESLint Guard Rails
Added ESLint rules to prevent regression:
- Restricts `process` usage in client-side code
- Allows `process` usage in server-side and shared code
- Provides clear error messages for violations

## Files Modified

### Core Migration Files
- `client/src/components/calendar/full-calendar-view.tsx` - Replaced `process.env.NODE_ENV`
- `shared/schema.ts` - Updated to use environment helper
- `shared/env-helper.ts` - New environment abstraction layer
- `vite.config.ts` - Added node polyfills and improved HMR

### Configuration Files
- `eslint.config.js` - New guard rail rules
- `package.json` - Added lint scripts
- `scripts/codemods/replace-process-env.ts` - Migration automation script

## Testing
- ✅ TypeScript compilation passes
- ✅ Vite build completes successfully
- ✅ Development server starts without errors
- ✅ ESLint guard rails prevent `process` usage in client code

## Benefits
1. **Vite 5 Compatibility**: Eliminates runtime Node.js global references in browser bundles
2. **Guard Rails**: Prevents future regressions with ESLint rules
3. **Tree Shaking**: Node polyfills are only included when needed and tree-shaken in production
4. **Consistency**: Unified environment variable interface for client and server code
5. **Replit Compatibility**: Improved HMR configuration for cloud development environments

## Breaking Changes
All client-side environment variables now require the `VITE_` prefix to be exposed to the browser. This is a security feature of Vite to prevent accidental exposure of sensitive server-side environment variables.

## Future Considerations
- Monitor for any third-party libraries that may introduce new Node.js global dependencies
- Consider creating additional environment variable categories if needed
- Update deployment scripts to include both server and client environment variables 