# Tech Debt Cleanup Plan - Dock Optimizer

## **Files to Remove** 🗑️

### **Test/Debug Components (No longer needed)**
```bash
# Test pages that were used for development
client/src/pages/test-fixed-appointment.tsx
client/src/pages/test-fixed-appointment-v2.tsx  
client/src/pages/test-appointment-patched.tsx
client/src/pages/auth-debug-page.tsx
client/src/pages/debug-auth.tsx
client/src/pages/websocket-test.tsx
client/src/components/debug/auth-debug.tsx
```

### **Backup Files (.bak)**
```bash
# All backup files can be safely removed
server/modules/admin/users/routes.ts.bak
client/src/pages/facility-settings.tsx.bak
client/src/pages/appointment-master.tsx.bak
client/src/components/door-manager/door-appointment-form.tsx.bak
client/src/components/shared/unified-appointment-form.tsx.bak
client/src/hooks/use-appointment-availability.tsx.bak
```

### **Test Scripts (Development only)**
```bash
# Test and verification scripts
test-*.js (all test files)
run-launch-verification.js
run-tests-before-deploy.sh
run-e2e-tests.sh
temp-fix.js
```

### **Attached Assets (Documentation artifacts)**
```bash
# Remove all attached_assets/*.txt files
attached_assets/
```

## **Code to Remove from Existing Files** ✂️

### **App.tsx - Remove Test Routes**
Remove these import statements:
```typescript
import AuthDebugPage from "@/pages/auth-debug-page";
import TestFixedAppointment from "@/pages/test-fixed-appointment";
import TestFixedAppointmentV2 from "@/pages/test-fixed-appointment-v2";
import TestAppointmentPatchedPage from "@/pages/test-appointment-patched";
import DebugAuthPage from "@/pages/debug-auth";
```

Remove these public routes:
```typescript
{ path: "/auth-debug", component: AuthDebugPage },
{ path: "/test-fixed-appointment", component: TestFixedAppointment },
{ path: "/test-fixed-appointment-v2", component: TestFixedAppointmentV2 },
{ path: "/test-appointment-patched", component: TestAppointmentPatchedPage },
{ path: "/debug-auth", component: DebugAuthPage }
```

### **Server Routes - Remove Test Endpoints**
In `server/routes.ts`, remove:
```typescript
// Test login endpoint (around line 98)
app.get('/api/test-login', ...)

// Test notification endpoint (around line 613) 
app.get('/api/test-notification-email', ...)
```

### **Asset Manager - Remove Unused Imports**
In `client/src/components/asset-manager/asset-import.tsx`:
- Remove unused TEMPLATE_HEADERS if not used elsewhere
- Clean up commented debugging code

## **Unused Features/Modules** 🚫

### **Checkout Notification (Orphaned)**
- `server/checkout-notification.ts` - appears to be duplicate functionality

### **Storage Index Exports**
In `server/storage/index.ts`, review if all exports are needed:
```typescript
export * from './modules';     // Check usage
export * from './organizations';
export * from './users'; 
export * from './features';
export * from './utils';       // Check usage
```

## **Code Simplification** 🔧

### **Remove TODO/FIXME Comments**
Replace these with proper implementations or remove:
```bash
# Examples found:
client/src/lib/appointment-availability.ts:91
server/services/blob-storage.ts:117
```

### **Cleanup Unused Imports**
Many files have imports that are no longer used due to refactoring.

### **Asset Manager Cleanup**
- Remove template code that isn't connected to real functionality
- Simplify overly complex import logic

## **Database Schema Cleanup** 📊

### **Company Assets Schema** 
In `shared/schema.ts`, the `companyAssets` table has many fields that may not be used:
- Review if all maintenance fields are needed
- Check if procurement fields are actually used
- Simplify if some complex fields can be combined

## **Module System Cleanup**

### **Feature Flags Service**
- Remove fallback complexity in `server/modules/featureFlags/service.ts` 
- Simplify in-memory vs database logic

### **Module Loading**
In `server/index.ts`, the module loading logic is overly complex:
- Standardize module loading approach
- Remove legacy compatibility code

## **Implementation Plan** 📋

### **Phase 1: Safe Removals (No Breaking Changes)**
1. Delete all `.bak` files
2. Remove test scripts and attached assets
3. Remove test/debug components from client
4. Clean up test routes from App.tsx

### **Phase 2: Code Cleanup**
1. Remove unused imports across files
2. Remove commented code blocks
3. Clean up TODO/FIXME comments
4. Simplify overly complex logic

### **Phase 3: Feature Cleanup (Requires Testing)**
1. Remove unused test endpoints from server
2. Simplify module loading logic
3. Review and simplify database schemas
4. Clean up unused exports

## **Estimated Savings** 💰

- **File Count**: ~50+ files removed
- **Code Size**: ~30-40% reduction in test/debug code
- **Bundle Size**: Reduced by removing unused components
- **Maintenance**: Less complexity to maintain
- **Build Time**: Faster builds with fewer files

## **Risk Assessment** ⚠️

- **Low Risk**: Test files, .bak files, debug components
- **Medium Risk**: Unused imports, commented code
- **High Risk**: Database schema changes, module system changes

## **Testing Required** ✅

After cleanup:
1. Full application build test
2. All main user flows work
3. External booking flow works
4. Admin functionality works
5. Module loading works correctly

## **Files That Should NOT be Removed** 🛡️

- Any files in `server/src/services/` (core business logic)
- Components actively used in main app flows
- Database migration files
- Production configuration files
- Core routing and authentication files 