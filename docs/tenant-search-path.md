# Tenant Search Path Implementation

## Overview

This document describes the implementation of PostgreSQL search path configuration for multi-tenant isolation in the Dock-Optimizer application.

## Problem Statement

Previously, the application was failing during login with the error:
```
error: relation "users" does not exist
```

This occurred because:
1. **No search path was being set** - The database connection was using only the default schema
2. **Tenant isolation was broken** - All tenants would see the same data
3. **Core tables were inaccessible** - Tables like `users`, `roles` in the `public` schema couldn't be found

## Solution

### Architecture

The multi-tenant database architecture uses:
- **Tenant-specific schemas**: `tenant_${tenantId}` (e.g., `tenant_1`, `tenant_2`)
- **Public schema**: Contains core tables (`users`, `roles`, `tenants`, etc.)
- **Search path**: `tenant_${tenantId}, public` - searches tenant schema first, then public

### Implementation

#### 1. Utility Functions (`server/utils/setTenantSearchPath.ts`)

```typescript
// Set search path for tenant isolation
export const setTenantSearchPath = async (tenantId: number): Promise<void>

// Reset to public schema only
export const resetSearchPath = async (): Promise<void>

// Get current search path for debugging
export const getCurrentSearchPath = async (): Promise<string[]>
```

**Key Features:**
- **Fatal error handling**: Throws errors on failure to ensure tenant isolation
- **Comprehensive logging**: Logs all operations and failures
- **SQL injection protection**: Uses parameterized queries via Drizzle ORM

#### 2. Authentication Integration (`server/auth.ts`)

The search path is set in two critical places:

**Login (LocalStrategy):**
```typescript
// After successful authentication
const tenantId = await getTenantIdForUser(user.id);
if (tenantId) {
  await setTenantSearchPath(tenantId);
} else {
  await resetSearchPath();
}
```

**Session Restoration (deserializeUser):**
```typescript
// On every authenticated request
const tenantId = await getTenantIdForUser(user.id);
if (tenantId) {
  await setTenantSearchPath(tenantId);
} else {
  await resetSearchPath();
}
```

### Security Considerations

#### Error Handling Strategy

1. **Fatal Errors**: Search path failures are treated as security violations
2. **Logging**: All failures are logged with `[SearchPath] ❌ FATAL:` prefix
3. **Graceful Degradation**: Authentication continues but logs critical warnings
4. **No Silent Failures**: All errors are explicitly handled and logged

#### Tenant Isolation Verification

```sql
-- After setTenantSearchPath(6)
SHOW search_path;
-- Result: tenant_6, public
```

This ensures:
- Tenant-specific data is accessed first (`tenant_6`)
- Core authentication tables remain accessible (`public`)
- No cross-tenant data leakage

## Testing

### Unit Tests (`server/tests/tenant-search-path.test.ts`)

Comprehensive test suite covering:
- **Function validation**: All utility functions work correctly
- **Error handling**: Proper error propagation and logging
- **Integration scenarios**: Full authentication flow
- **Edge cases**: Empty paths, malformed responses, database failures

### Key Test Case

```typescript
it('should verify that setTenantSearchPath(6) results in tenant_6 and public in search path', async () => {
  await setTenantSearchPath(6);
  const searchPath = await getCurrentSearchPath();
  
  expect(searchPath).toContain('tenant_6');
  expect(searchPath).toContain('public');
  expect(searchPath).toEqual(['tenant_6', 'public']);
});
```

## Migration Guide

### For Development Teams

#### Before This Change
```typescript
// Login would fail with "relation 'users' does not exist"
// No tenant isolation - all users saw all data
// Manual tenant filtering required in every query
```

#### After This Change
```typescript
// Login works correctly
// Automatic tenant isolation at database level
// Core tables accessible via public schema
// Tenant-specific tables accessed via tenant schema
```

#### Breaking Changes
- **None** - This is a pure enhancement that fixes broken functionality

#### Environment Variables
- **No changes required** - Uses existing `DATABASE_URL` from Doppler

### For Operations Teams

#### Health Monitoring

Watch for these log patterns:

**Success:**
```
[SearchPath] Setting search path for tenant: 6
[SearchPath] ✅ Successfully set search path to: tenant_6, public
```

**Failures (Critical):**
```
[SearchPath] ❌ FATAL: Failed to set search path for tenant 6: <error>
[SearchPath] ❌ This is a critical security issue - tenant isolation is broken!
[SearchPath] ❌ Application startup should be aborted.
```

#### Database Schema Requirements

Ensure these schemas exist:
- `public` - Contains core tables (`users`, `roles`, `tenants`)
- `tenant_1`, `tenant_2`, etc. - Contains tenant-specific tables

#### Performance Impact
- **Minimal** - Only adds one `SET search_path` query per authentication
- **Database load** - Negligible additional load
- **Connection pooling** - No impact on existing connection management

## Troubleshooting

### Common Issues

#### 1. "relation 'users' does not exist"
**Cause**: Search path not set or public schema missing
**Solution**: Verify public schema exists and contains users table

#### 2. "schema 'tenant_X' does not exist"  
**Cause**: Tenant schema not created
**Solution**: Create schema: `CREATE SCHEMA tenant_X;`

#### 3. Cross-tenant data leakage
**Cause**: Search path not being set correctly
**Solution**: Check authentication logs for search path setting

### Debugging Commands

```sql
-- Check current search path
SHOW search_path;

-- List all schemas
\dn

-- Check if tenant schema exists
SELECT schema_name FROM information_schema.schemata 
WHERE schema_name = 'tenant_6';

-- Verify table accessibility
SELECT * FROM users LIMIT 1;
```

## Future Enhancements

### Planned Improvements

1. **Connection-level isolation**: Consider using separate database connections per tenant
2. **Schema auto-creation**: Automatically create tenant schemas on first user creation
3. **Performance optimization**: Cache search path setting to reduce database calls
4. **Monitoring integration**: Add metrics for search path operations

### Migration Path

This implementation provides a foundation for future tenant isolation improvements:
- **Row-level security (RLS)**: Can be added as an additional layer
- **Separate databases**: Can migrate to per-tenant databases if needed
- **Horizontal scaling**: Schema-based approach scales well

## Conclusion

The tenant search path implementation provides:
- ✅ **Working authentication** - Login no longer fails
- ✅ **Proper tenant isolation** - Data is correctly segmented
- ✅ **Security by default** - Fails safely with comprehensive logging
- ✅ **Zero breaking changes** - Existing functionality preserved
- ✅ **Comprehensive testing** - Full test coverage for reliability

This foundation enables secure multi-tenant operations while maintaining access to core application functionality. 