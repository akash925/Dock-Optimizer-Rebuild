// FIX DOCKS API TENANT FILTERING & AVAILABILITY SERVICE
// Fixes the exact bugs identified in the logs

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

console.log('🔧 FIXING DOCKS API TENANT FILTERING & AVAILABILITY SERVICE\n');

// Fix 1: Update server/routes.ts to use organization_facilities for docks filtering
function fixDocksAPITenantFiltering() {
  console.log('🔧 FIX 1: Docks API Tenant Filtering\n');
  
  const routesFile = 'server/routes.ts';
  
  if (!fs.existsSync(routesFile)) {
    console.log('❌ server/routes.ts not found');
    return false;
  }
  
  let content = fs.readFileSync(routesFile, 'utf8');
  
  // Find the problematic docks filtering code
  const oldDockCode = `      // Filter docks by tenant ID through facility association
      const facilities = await storage.getFacilities();
      console.log(\`[Docks] Total facilities in database: \${facilities.length}\`);
      
      const tenantFacilities = facilities.filter(facility => facility.tenantId === currentUser.tenantId);
      console.log(\`[Docks] Facilities for tenant \${currentUser.tenantId}: \${tenantFacilities.length}\`);
      tenantFacilities.forEach(facility => {
        console.log(\`[Docks] Tenant facility \${facility.id}: \${facility.name}, tenantId: \${facility.tenantId}\`);
      });
      
      const tenantFacilityIds = tenantFacilities.map(facility => facility.id);
      console.log(\`[Docks] Tenant facility IDs: [\${tenantFacilityIds.join(', ')}]\`);
      
      const tenantDocks = docks.filter(dock => tenantFacilityIds.includes(dock.facilityId));`;
  
  const newDockCode = `      // Filter docks by tenant ID through organization_facilities junction table
      console.log(\`[Docks] Using organization_facilities for tenant isolation\`);
      
      const tenantFacilities = await storage.getFacilitiesByOrganizationId(currentUser.tenantId);
      console.log(\`[Docks] Facilities for tenant \${currentUser.tenantId}: \${tenantFacilities.length}\`);
      tenantFacilities.forEach(facility => {
        console.log(\`[Docks] Tenant facility \${facility.id}: \${facility.name}\`);
      });
      
      const tenantFacilityIds = tenantFacilities.map(facility => facility.id);
      console.log(\`[Docks] Tenant facility IDs: [\${tenantFacilityIds.join(', ')}]\`);
      
      const tenantDocks = docks.filter(dock => tenantFacilityIds.includes(dock.facilityId));`;
  
  if (content.includes(oldDockCode)) {
    content = content.replace(oldDockCode, newDockCode);
    fs.writeFileSync(routesFile, content);
    console.log('✅ Fixed docks API tenant filtering to use organization_facilities');
    return true;
  } else {
    console.log('ℹ️  Docks API filtering code not found or already updated');
    return false;
  }
}

// Fix 2: Update availability service to import isValid from date-fns
function fixAvailabilityServiceImport() {
  console.log('\n🔧 FIX 2: Availability Service Missing Import\n');
  
  const availabilityFile = 'server/src/services/availability.ts';
  
  if (!fs.existsSync(availabilityFile)) {
    console.log('❌ server/src/services/availability.ts not found');
    return false;
  }
  
  let content = fs.readFileSync(availabilityFile, 'utf8');
  
  // Check if import already includes isValid
  if (content.includes('import { format, isValid }')) {
    console.log('✅ isValid already imported');
    return true;
  }
  
  // Find the date-fns import line and add isValid
  const oldImport = 'import { format } from \'date-fns\';';
  const newImport = 'import { format, isValid } from \'date-fns\';';
  
  if (content.includes(oldImport)) {
    content = content.replace(oldImport, newImport);
    fs.writeFileSync(availabilityFile, content);
    console.log('✅ Added isValid import to availability service');
    return true;
  } else {
    console.log('ℹ️  Could not find date-fns import to update');
    return false;
  }
}

// Main execution
async function runFixes() {
  console.log('🚀 Running targeted fixes for identified bugs...\n');
  
  const results = [];
  
  // Apply fixes
  const fix1Success = fixDocksAPITenantFiltering();
  results.push({ name: 'Docks API Tenant Filtering', success: fix1Success });
  
  const fix2Success = fixAvailabilityServiceImport();
  results.push({ name: 'Availability Service Import', success: fix2Success });
  
  // Summary
  console.log('\n🎯 FIX RESULTS:');
  const successful = results.filter(r => r.success).length;
  const total = results.length;
  
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.name}`);
  });
  
  console.log(`\n📊 SUCCESS RATE: ${successful}/${total} fixes applied`);
  
  if (successful === total) {
    console.log('\n🎉 ALL FIXES APPLIED SUCCESSFULLY!');
    console.log('\n🔄 NEXT STEPS:');
    console.log('1. Restart your Replit server');
    console.log('2. Test Door Manager - should now show docks for Organization 2');
    console.log('3. Test External Booking - should now show time slots');
    console.log('\n✅ Expected Results:');
    console.log('- Door Manager will use organization_facilities for proper tenant isolation');
    console.log('- External booking will have proper date validation and no crashes');
  } else {
    console.log('\n⚠️  Some fixes may need manual application');
    console.log('Check the error messages above for details');
  }
}

// Execute the fixes
runFixes().catch(console.error); 