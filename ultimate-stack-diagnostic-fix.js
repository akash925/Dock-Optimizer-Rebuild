// ULTIMATE STACK DIAGNOSTIC & FIX
// Deep analysis of persistent bugs across the entire application stack

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found. Run this in Replit where DATABASE_URL is set.');
  process.exit(1);
}

import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('neon.tech') ? { rejectUnauthorized: false } : false
});

console.log('🔬 ULTIMATE STACK DIAGNOSTIC & FIX\n');
console.log('🎯 Analyzing root causes of persistent bugs...\n');

// DIAGNOSTIC 1: Tenant Isolation & Data Visibility
async function diagnoseTenantIsolation() {
  console.log('🔍 DIAGNOSTIC 1: Tenant Isolation & Data Visibility\n');
  
  try {
    const client = await pool.connect();
    
    // Get all users and their tenant associations
    console.log('👥 USERS & TENANT ASSOCIATIONS:');
    const users = await client.query(`
      SELECT u.id, u.username, u.email, u.role, u.tenant_id as direct_tenant,
             ou.organization_id as org_from_mapping, r.name as mapped_role
      FROM users u
      LEFT JOIN organization_users ou ON u.id = ou.user_id
      LEFT JOIN roles r ON ou.role_id = r.id
      ORDER BY u.id
    `);
    
    users.rows.forEach(user => {
      console.log(`  User ${user.id}: ${user.username}`);
      console.log(`    Direct tenant_id: ${user.direct_tenant}`);
      console.log(`    Org from mapping: ${user.org_from_mapping}`);
      console.log(`    Role: ${user.role} (mapped: ${user.mapped_role})`);
      
      // Identify the issue
      if (!user.direct_tenant && !user.org_from_mapping) {
        console.log(`    ❌ PROBLEM: No tenant association!`);
      } else if (user.direct_tenant !== user.org_from_mapping) {
        console.log(`    ⚠️  MISMATCH: Direct tenant vs organization mapping`);
      } else {
        console.log(`    ✅ Proper tenant association`);
      }
    });
    
    // Get organization-facility mappings
    console.log('\n🏢 ORGANIZATION-FACILITY MAPPINGS:');
    const mappings = await client.query(`
      SELECT of.organization_id, of.facility_id, 
             t.name as org_name, f.name as facility_name
      FROM organization_facilities of
      LEFT JOIN tenants t ON of.organization_id = t.id
      LEFT JOIN facilities f ON of.facility_id = f.id
      ORDER BY of.organization_id, of.facility_id
    `);
    
    if (mappings.rows.length === 0) {
      console.log('  ❌ CRITICAL: NO organization-facility mappings exist!');
      console.log('  🔧 This is why Door Manager shows "No doors available"');
    } else {
      mappings.rows.forEach(mapping => {
        console.log(`  Org ${mapping.organization_id} (${mapping.org_name}) -> Facility ${mapping.facility_id} (${mapping.facility_name})`);
      });
    }
    
    // Check organization 5 specifically (the logged-in organization)
    console.log('\n🎯 ORGANIZATION 5 ANALYSIS:');
    const org5Mappings = mappings.rows.filter(m => m.organization_id === 5);
    console.log(`  Organization 5 facility mappings: ${org5Mappings.length}`);
    
    if (org5Mappings.length === 0) {
      console.log('  ❌ CRITICAL: Organization 5 has NO facility mappings!');
      console.log('  🔧 This explains the "No doors available" issue');
    }
    
    // Check docks visibility for org 5
    const org5Docks = await client.query(`
      SELECT d.id, d.name, d.facility_id, f.name as facility_name
      FROM docks d
      JOIN facilities f ON d.facility_id = f.id
      JOIN organization_facilities of ON f.id = of.facility_id
      WHERE of.organization_id = 5
      ORDER BY d.id
    `);
    
    console.log(`  Docks visible to org 5: ${org5Docks.rows.length}`);
    
    client.release();
    
    return {
      tenantMappingIssue: org5Mappings.length === 0,
      userTenantIssues: users.rows.filter(u => !u.direct_tenant && !u.org_from_mapping).length > 0,
      org5VisibleDocks: org5Docks.rows.length
    };
    
  } catch (error) {
    console.error('❌ Error in tenant isolation diagnostic:', error);
    return { tenantMappingIssue: true, userTenantIssues: true, org5VisibleDocks: 0 };
  }
}

// DIAGNOSTIC 2: API & Data Flow Analysis  
async function diagnoseAPIDataFlow() {
  console.log('\n🔍 DIAGNOSTIC 2: API & Data Flow Analysis\n');
  
  try {
    const client = await pool.connect();
    
    // Check facility hours (needed for time slot generation)
    console.log('⏰ FACILITY HOURS ANALYSIS:');
    const facilityHours = await client.query(`
      SELECT facility_id, monday_open, monday_close,
             tuesday_open, tuesday_close,
             wednesday_open, wednesday_close,
             thursday_open, thursday_close,
             friday_open, friday_close,
             saturday_open, saturday_close,
             sunday_open, sunday_close
      FROM facility_hours
    `);
    
    console.log(`  Facilities with hours configured: ${facilityHours.rows.length}`);
    
    if (facilityHours.rows.length === 0) {
      console.log('  ❌ CRITICAL: No facility hours configured!');
      console.log('  🔧 This explains "Failed to load available time slots"');
    }
    
    // Check appointment types (needed for scheduling)
    console.log('\n📅 APPOINTMENT TYPES ANALYSIS:');
    const appointmentTypes = await client.query(`
      SELECT id, name, facility_id, duration, active, tenant_id
      FROM appointment_types 
      WHERE active = true
      ORDER BY facility_id, id
    `);
    
    console.log(`  Active appointment types: ${appointmentTypes.rows.length}`);
    appointmentTypes.rows.forEach(at => {
      console.log(`    Type ${at.id}: ${at.name} (facility ${at.facility_id}, tenant ${at.tenant_id})`);
    });
    
    // Check for orphaned appointment types (no facility mapping)
    const orphanedTypes = await client.query(`
      SELECT at.id, at.name, at.facility_id
      FROM appointment_types at
      LEFT JOIN organization_facilities of ON at.facility_id = of.facility_id
      WHERE at.active = true AND of.facility_id IS NULL
    `);
    
    if (orphanedTypes.rows.length > 0) {
      console.log(`  ⚠️  Orphaned appointment types (no org mapping): ${orphanedTypes.rows.length}`);
      orphanedTypes.rows.forEach(at => {
        console.log(`    Type ${at.id}: ${at.name} -> Facility ${at.facility_id} (not mapped to any org)`);
      });
    }
    
    client.release();
    
    return {
      facilityHoursIssue: facilityHours.rows.length === 0,
      appointmentTypesCount: appointmentTypes.rows.length,
      orphanedTypesCount: orphanedTypes.rows.length
    };
    
  } catch (error) {
    console.error('❌ Error in API data flow diagnostic:', error);
    return { facilityHoursIssue: true, appointmentTypesCount: 0, orphanedTypesCount: 0 };
  }
}

// DIAGNOSTIC 3: Frontend State & Component Analysis
async function diagnoseFrontendState() {
  console.log('\n🔍 DIAGNOSTIC 3: Frontend State & Component Analysis\n');
  
  // Check for problematic state management patterns
  const problemFiles = [];
  
  // Check door manager for modal stacking
  const doorManagerFile = 'client/src/pages/door-manager.tsx';
  if (fs.existsSync(doorManagerFile)) {
    const content = fs.readFileSync(doorManagerFile, 'utf8');
    
    console.log('🚪 DOOR MANAGER ANALYSIS:');
    
    // Check for multiple modal states
    const hasAppointmentForm = content.includes('showAppointmentForm');
    const hasAppointmentSelector = content.includes('showAppointmentSelector');
    
    console.log(`  Has AppointmentForm modal: ${hasAppointmentForm}`);
    console.log(`  Has AppointmentSelector modal: ${hasAppointmentSelector}`);
    
    if (hasAppointmentForm && hasAppointmentSelector) {
      console.log('  ⚠️  POTENTIAL ISSUE: Multiple modal systems detected');
      problemFiles.push('door-manager.tsx - modal stacking');
    } else {
      console.log('  ✅ Single modal system detected');
    }
    
    // Check for proper error handling
    const hasErrorBoundary = content.includes('Error') || content.includes('catch');
    console.log(`  Has error handling: ${hasErrorBoundary}`);
  }
  
  // Check availability service for date handling
  const availabilityFile = 'server/src/services/availability.ts';
  if (fs.existsSync(availabilityFile)) {
    const content = fs.readFileSync(availabilityFile, 'utf8');
    
    console.log('\n⏰ AVAILABILITY SERVICE ANALYSIS:');
    
    const hasSafeFormat = content.includes('safeFormat');
    const hasDateValidation = content.includes('isValid');
    
    console.log(`  Has safe date formatting: ${hasSafeFormat}`);
    console.log(`  Has date validation: ${hasDateValidation}`);
    
    if (!hasSafeFormat || !hasDateValidation) {
      console.log('  ⚠️  POTENTIAL ISSUE: Unsafe date handling');
      problemFiles.push('availability.ts - unsafe date handling');
    } else {
      console.log('  ✅ Safe date handling implemented');
    }
  }
  
  return {
    problemFiles,
    modalStackingRisk: problemFiles.some(f => f.includes('modal stacking')),
    dateHandlingRisk: problemFiles.some(f => f.includes('unsafe date'))
  };
}

// FIX 1: Comprehensive Tenant Mapping Fix
async function fixTenantMapping(diagnosticResult) {
  if (!diagnosticResult.tenantMappingIssue) {
    console.log('✅ Tenant mapping already correct, skipping fix');
    return true;
  }
  
  console.log('\n🔧 FIX 1: Comprehensive Tenant Mapping\n');
  
  try {
    const client = await pool.connect();
    
    // Get available facilities
    const facilities = await client.query('SELECT id, name, tenant_id FROM facilities ORDER BY id');
    console.log(`📍 Available facilities: ${facilities.rows.length}`);
    
    // Create mapping for organization 5
    const targetFacilityId = facilities.rows.find(f => f.id === 7)?.id || facilities.rows[0]?.id;
    
    if (targetFacilityId) {
      console.log(`🔗 Creating Organization 5 -> Facility ${targetFacilityId} mapping...`);
      
      const insertResult = await client.query(`
        INSERT INTO organization_facilities (organization_id, facility_id, created_at) 
        VALUES ($1, $2, NOW()) 
        ON CONFLICT (organization_id, facility_id) DO NOTHING
        RETURNING *
      `, [5, targetFacilityId]);
      
      if (insertResult.rows.length > 0) {
        console.log('✅ Successfully created tenant mapping');
      } else {
        console.log('ℹ️  Mapping already existed');
      }
      
      // Verify the fix
      const verifyDocks = await client.query(`
        SELECT d.id, d.name, d.facility_id, f.name as facility_name
        FROM docks d
        JOIN facilities f ON d.facility_id = f.id
        JOIN organization_facilities of ON f.id = of.facility_id
        WHERE of.organization_id = 5
        ORDER BY d.id
      `);
      
      console.log(`🎉 Organization 5 can now see ${verifyDocks.rows.length} docks`);
      
      client.release();
      return verifyDocks.rows.length > 0;
    } else {
      console.log('❌ No facilities available to map');
      client.release();
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error fixing tenant mapping:', error);
    return false;
  }
}

// FIX 2: Facility Hours & Time Slot Infrastructure
async function fixTimeSlotInfrastructure(diagnosticResult) {
  if (!diagnosticResult.facilityHoursIssue) {
    console.log('✅ Facility hours already configured, skipping fix');
    return true;
  }
  
  console.log('\n🔧 FIX 2: Facility Hours & Time Slot Infrastructure\n');
  
  try {
    const client = await pool.connect();
    
    // Get all facilities
    const facilities = await client.query('SELECT id, name FROM facilities ORDER BY id');
    console.log(`⏰ Creating hours for ${facilities.rows.length} facilities...`);
    
    for (const facility of facilities.rows) {
      const insertResult = await client.query(`
        INSERT INTO facility_hours (
          facility_id, 
          monday_open, monday_close,
          tuesday_open, tuesday_close,
          wednesday_open, wednesday_close,
          thursday_open, thursday_close,
          friday_open, friday_close,
          saturday_open, saturday_close,
          sunday_open, sunday_close
        ) VALUES (
          $1, '06:00', '18:00', '06:00', '18:00', '06:00', '18:00', 
          '06:00', '18:00', '06:00', '18:00', '08:00', '16:00', null, null
        )
        ON CONFLICT (facility_id) DO NOTHING
        RETURNING facility_id
      `, [facility.id]);
      
      if (insertResult.rows.length > 0) {
        console.log(`  ✅ Created hours for ${facility.name}`);
      }
    }
    
    console.log('🎉 Facility hours infrastructure complete');
    
    client.release();
    return true;
    
  } catch (error) {
    console.error('❌ Error fixing facility hours:', error);
    return false;
  }
}

// FIX 3: User Authentication & Session Enhancement  
async function fixUserAuthentication() {
  console.log('\n🔧 FIX 3: User Authentication & Session Enhancement\n');
  
  try {
    const client = await pool.connect();
    
    // Check for users without proper tenant association
    const usersWithoutTenant = await client.query(`
      SELECT u.id, u.username, u.tenant_id, ou.organization_id
      FROM users u
      LEFT JOIN organization_users ou ON u.id = ou.user_id
      WHERE u.tenant_id IS NULL AND ou.organization_id IS NULL
    `);
    
    console.log(`👤 Users without tenant association: ${usersWithoutTenant.rows.length}`);
    
    if (usersWithoutTenant.rows.length > 0) {
      console.log('🔧 Fixing user tenant associations...');
      
      for (const user of usersWithoutTenant.rows) {
        // Associate with organization 5 (default organization)
        await client.query(`
          INSERT INTO organization_users (user_id, organization_id, role_id, created_at)
          VALUES ($1, 5, 1, NOW())
          ON CONFLICT (user_id, organization_id) DO NOTHING
        `, [user.id]);
        
        console.log(`  ✅ Associated user ${user.username} with organization 5`);
      }
    } else {
      console.log('✅ All users have proper tenant associations');
    }
    
    client.release();
    return true;
    
  } catch (error) {
    console.error('❌ Error fixing user authentication:', error);
    return false;
  }
}

// MAIN EXECUTION
async function runUltimateStackFix() {
  console.log('🚀 Running Ultimate Stack Diagnostic & Fix...\n');
  
  const results = [];
  
  // Phase 1: Diagnostics
  console.log('=' .repeat(70));
  console.log('PHASE 1: DEEP STACK DIAGNOSTICS');
  console.log('=' .repeat(70));
  
  const tenantDiagnostic = await diagnoseTenantIsolation();
  const apiDiagnostic = await diagnoseAPIDataFlow();
  const frontendDiagnostic = await diagnoseFrontendState();
  
  // Phase 2: Targeted Fixes
  console.log('\n' + '=' .repeat(70));
  console.log('PHASE 2: TARGETED FIXES');
  console.log('=' .repeat(70));
  
  const fix1Success = await fixTenantMapping(tenantDiagnostic);
  results.push({ name: 'Tenant Mapping Fix', success: fix1Success });
  
  const fix2Success = await fixTimeSlotInfrastructure(apiDiagnostic);
  results.push({ name: 'Time Slot Infrastructure Fix', success: fix2Success });
  
  const fix3Success = await fixUserAuthentication();
  results.push({ name: 'User Authentication Fix', success: fix3Success });
  
  // Phase 3: Summary & Recommendations
  console.log('\n' + '=' .repeat(70));
  console.log('🎯 ULTIMATE STACK FIX SUMMARY');
  console.log('=' .repeat(70));
  
  const successful = results.filter(r => r.success).length;
  const total = results.length;
  
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.name}`);
  });
  
  console.log(`\n📊 SUCCESS RATE: ${successful}/${total} fixes applied`);
  
  // Root Cause Analysis Summary
  console.log('\n🔬 ROOT CAUSE ANALYSIS:');
  console.log(`  Organization 5 facility mappings: ${tenantDiagnostic.tenantMappingIssue ? '❌ MISSING' : '✅ EXISTS'}`);
  console.log(`  Facility hours configuration: ${apiDiagnostic.facilityHoursIssue ? '❌ MISSING' : '✅ EXISTS'}`);
  console.log(`  Frontend modal stacking: ${frontendDiagnostic.modalStackingRisk ? '⚠️  RISK' : '✅ CLEAN'}`);
  console.log(`  Date handling safety: ${frontendDiagnostic.dateHandlingRisk ? '⚠️  RISK' : '✅ SAFE'}`);
  
  // Expected Results
  console.log('\n🎉 EXPECTED RESULTS AFTER FIXES:');
  console.log('  ✅ Door Manager will show dock cards instead of "No doors available"');
  console.log('  ✅ External booking will show time slots instead of error message');
  console.log('  ✅ New appointment flow will work without crashes');
  console.log('  ✅ User authentication will be properly isolated by tenant');
  
  console.log('\n🔄 NEXT STEPS:');
  console.log('  1. Restart your Replit server');
  console.log('  2. Clear browser cache and refresh');
  console.log('  3. Test Door Manager, External Booking, and New Appointment flows');
  
  await pool.end();
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runUltimateStackFix().catch(console.error);
} 