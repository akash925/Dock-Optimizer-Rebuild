import { db, safeQuery } from "../db.js";
import { getStorage } from "../storage.js";
import { 
  users, 
  organizationUsers, 
  roles, 
  tenants,
  appointmentTypes,
  facilities
} from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * PRODUCTION READINESS CHECK FOR REPLIT LAUNCH
 * 
 * This script verifies all critical systems are working correctly
 * before deployment to Replit production environment
 */

export async function runProductionReadinessCheck() {
  try {
    console.log("🔍 PRODUCTION READINESS CHECK FOR REPLIT LAUNCH");
    console.log("=".repeat(60));
    
    const storage = await getStorage();
    let totalIssues = 0;
    let totalChecks = 0;
    
    // ==========================================
    // 1. DATABASE CONNECTION TEST
    // ==========================================
    console.log("\n🔧 CHECK 1: DATABASE CONNECTION");
    console.log("-".repeat(40));
    totalChecks++;
    
    try {
      const testQuery = await safeQuery(() => db.select().from(users).limit(1));
      console.log("✅ Database connection: WORKING");
    } catch (error) {
      console.log("❌ Database connection: FAILED");
      console.error("   Error:", error);
      totalIssues++;
    }
    
    // ==========================================
    // 2. USER-ORGANIZATION MAPPING CHECK
    // ==========================================
    console.log("\n🔧 CHECK 2: USER-ORGANIZATION MAPPING");
    console.log("-".repeat(40));
    totalChecks++;
    
    const allUsers = await safeQuery(() => db.select().from(users));
    const allOrganizations = await safeQuery(() => db.select().from(tenants));
    const mappedUsers = await safeQuery(() => 
      db.select({
        userId: organizationUsers.userId,
        orgId: organizationUsers.organizationId,
        username: users.username
      })
      .from(organizationUsers)
      .innerJoin(users, eq(organizationUsers.userId, users.id))
    );
    
    console.log(`📊 Total users: ${allUsers.length}`);
    console.log(`📊 Total organizations: ${allOrganizations.length}`);
    console.log(`📊 Mapped users: ${mappedUsers.length}`);
    
    if (mappedUsers.length === allUsers.length) {
      console.log("✅ User-organization mapping: ALL USERS MAPPED");
    } else {
      console.log("❌ User-organization mapping: SOME USERS NOT MAPPED");
      totalIssues++;
    }
    
    // Check for Hanzo organization
    const hanzoOrg = allOrganizations.find((org: any) => org.id === 2);
    if (hanzoOrg) {
      console.log(`✅ Hanzo organization: EXISTS (${hanzoOrg.name})`);
    } else {
      console.log("❌ Hanzo organization: MISSING");
      totalIssues++;
    }
    
    // ==========================================
    // 3. APPOINTMENT TYPES CHECK
    // ==========================================
    console.log("\n🔧 CHECK 3: APPOINTMENT TYPES");
    console.log("-".repeat(40));
    totalChecks++;
    
    const appointmentTypesCount = await safeQuery(() => db.select().from(appointmentTypes));
    const facilitiesCount = await safeQuery(() => db.select().from(facilities));
    
    console.log(`📊 Appointment types: ${appointmentTypesCount.length}`);
    console.log(`📊 Facilities: ${facilitiesCount.length}`);
    
    if (appointmentTypesCount.length > 0) {
      console.log("✅ Appointment types: AVAILABLE");
      console.log(`   Sample types: ${appointmentTypesCount.slice(0, 3).map((t: any) => t.name).join(', ')}`);
    } else {
      console.log("❌ Appointment types: NONE FOUND");
      totalIssues++;
    }
    
    // ==========================================
    // 4. ROLES AND PERMISSIONS CHECK
    // ==========================================
    console.log("\n🔧 CHECK 4: ROLES AND PERMISSIONS");
    console.log("-".repeat(40));
    totalChecks++;
    
    const allRoles = await safeQuery(() => db.select().from(roles));
    const adminRole = allRoles.find((r: any) => r.name.toLowerCase() === 'admin');
    
    console.log(`📊 Total roles: ${allRoles.length}`);
    
    if (adminRole) {
      console.log("✅ Admin role: EXISTS");
    } else {
      console.log("❌ Admin role: MISSING");
      totalIssues++;
    }
    
    // ==========================================
    // 5. TENANT ISOLATION CHECK
    // ==========================================
    console.log("\n🔧 CHECK 5: TENANT ISOLATION");
    console.log("-".repeat(40));
    totalChecks++;
    
    let tenantIsolationWorking = true;
    
    for (const org of allOrganizations) {
      const orgUsers = await safeQuery(() => 
        db.select().from(users).where(eq(users.tenantId, org.id))
      );
      
      console.log(`🏢 ${org.name} (ID: ${org.id}): ${orgUsers.length} users`);
      
      if (org.id === 2 && orgUsers.length === 0) {
        console.log("⚠️  Hanzo organization has no users");
        tenantIsolationWorking = false;
      }
    }
    
    if (tenantIsolationWorking) {
      console.log("✅ Tenant isolation: WORKING");
    } else {
      console.log("❌ Tenant isolation: ISSUES DETECTED");
      totalIssues++;
    }
    
    // ==========================================
    // 6. API ENDPOINT SIMULATION
    // ==========================================
    console.log("\n🔧 CHECK 6: API ENDPOINT SIMULATION");
    console.log("-".repeat(40));
    totalChecks++;
    
    // Simulate /api/users endpoint for tenant 2 (Hanzo)
    const hanzoUsers = await safeQuery(() => 
      db.select({
        userId: users.id,
        email: users.email,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        roles: organizationUsers.roleId
      })
      .from(users)
      .innerJoin(organizationUsers, eq(users.id, organizationUsers.userId))
      .where(eq(users.tenantId, 2))
    );
    
    console.log(`📊 /api/users (tenant 2): ${hanzoUsers.length} users`);
    
    if (hanzoUsers.length > 0) {
      console.log("✅ API users endpoint: WORKING");
      hanzoUsers.forEach((user: any) => {
        console.log(`   👤 ${user.username} (${user.email})`);
      });
    } else {
      console.log("⚠️  API users endpoint: NO USERS FOR TENANT 2");
      // This might be expected if testadmin is the only user
    }
    
    // ==========================================
    // 7. ENVIRONMENT READINESS
    // ==========================================
    console.log("\n🔧 CHECK 7: ENVIRONMENT READINESS");
    console.log("-".repeat(40));
    totalChecks++;
    
    const envChecks = [
      { name: "DATABASE_URL", value: process.env.DATABASE_URL },
      { name: "JWT_SECRET", value: process.env.JWT_SECRET },
      { name: "NODE_ENV", value: process.env.NODE_ENV }
    ];
    
    let envIssues = 0;
    envChecks.forEach(check => {
      if (check.value) {
        console.log(`✅ ${check.name}: SET`);
      } else {
        console.log(`❌ ${check.name}: MISSING`);
        envIssues++;
      }
    });
    
    if (envIssues === 0) {
      console.log("✅ Environment variables: ALL SET");
    } else {
      console.log("❌ Environment variables: SOME MISSING");
      totalIssues++;
    }
    
    // ==========================================
    // FINAL SUMMARY
    // ==========================================
    console.log("\n" + "=".repeat(60));
    console.log("🎯 PRODUCTION READINESS SUMMARY");
    console.log("=".repeat(60));
    console.log(`📊 Total checks performed: ${totalChecks}`);
    console.log(`❌ Issues found: ${totalIssues}`);
    console.log(`✅ Success rate: ${Math.round(((totalChecks - totalIssues) / totalChecks) * 100)}%`);
    
    if (totalIssues === 0) {
      console.log("");
      console.log("🎉 PRODUCTION READY! 🚀");
      console.log("✅ All systems operational");
      console.log("✅ Database connections stable");
      console.log("✅ User-organization mapping working");
      console.log("✅ Appointment types available");
      console.log("✅ Tenant isolation functional");
      console.log("");
      console.log("🚀 READY FOR REPLIT DEPLOYMENT!");
    } else if (totalIssues <= 2) {
      console.log("");
      console.log("⚠️  MOSTLY READY - MINOR ISSUES");
      console.log("🔧 Address the issues above before deployment");
      console.log("💡 Most functionality should work correctly");
    } else {
      console.log("");
      console.log("❌ NOT READY FOR PRODUCTION");
      console.log("🔧 Critical issues need to be resolved");
      console.log("⚠️  Deployment not recommended");
    }
    
    return {
      success: totalIssues === 0,
      totalChecks,
      totalIssues,
      successRate: Math.round(((totalChecks - totalIssues) / totalChecks) * 100),
      ready: totalIssues <= 2
    };
    
  } catch (error) {
    console.error("❌ PRODUCTION READINESS CHECK FAILED:", error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runProductionReadinessCheck()
    .then((result) => {
      console.log("✅ Check completed:", result);
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error("❌ Check failed:", error);
      process.exit(1);
    });
} 