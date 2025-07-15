# Changelog

## [Unreleased]

### Added
- **Tenant Search Path Implementation** - Fixed multi-tenant database isolation
  - Added `setTenantSearchPath()` utility for PostgreSQL search path configuration
  - Integrated search path setting into authentication flow (login and session restoration)
  - Search path now includes both `tenant_${tenantId}` and `public` schemas
  - Fixed "relation 'users' does not exist" login error
  - Added comprehensive unit tests for search path functionality
  - Added fatal error handling and logging for security violations
  - Added documentation in `docs/tenant-search-path.md`

### Fixed
- **Authentication Flow** - Login no longer fails with "relation 'users' does not exist"
- **Tenant Isolation** - Proper database-level tenant separation now enforced
- **Schema Access** - Core tables in `public` schema remain accessible across tenants

### Technical Details
- New files: `server/utils/setTenantSearchPath.ts`, `server/tests/tenant-search-path.test.ts`, `docs/tenant-search-path.md`
- Modified files: `server/auth.ts` (added search path setting in authentication)
- No breaking changes or environment variable updates required
- Backward compatible with existing tenant setup

## Previous Entries... 