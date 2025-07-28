// server/storage/tenants.ts

import { db } from "../db.js";
import { users, tenants, organizationUsers } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function getTenantIdForUser(userId: number): Promise<number | null> {
  // First, check if user has a direct tenantId
  const [user] = await db
    .select({ tenantId: users.tenantId })
    .from(users)
    .where(eq(users.id, userId));
  
  if (user?.tenantId) {
    console.log(`[getTenantIdForUser] Found direct tenantId ${user.tenantId} for user ${userId}`);
    return user.tenantId;
  }
  
  // If no direct tenantId, check organizationUsers table for manual assignments
  const [orgUser] = await db
    .select({ organizationId: organizationUsers.organizationId })
    .from(organizationUsers)
    .where(eq(organizationUsers.userId, userId))
    .limit(1);
    
  if (orgUser?.organizationId) {
    console.log(`[getTenantIdForUser] Found organization assignment ${orgUser.organizationId} for user ${userId}`);
    
    // IMPORTANT: Update the user's tenantId for future lookups to be more efficient
    try {
      await db
        .update(users)
        .set({ tenantId: orgUser.organizationId })
        .where(eq(users.id, userId));
      console.log(`[getTenantIdForUser] Updated user ${userId} tenantId to ${orgUser.organizationId}`);
    } catch (error) {
      console.error(`[getTenantIdForUser] Failed to update user tenantId:`, error);
    }
    
    return orgUser.organizationId;
  }
  
  console.log(`[getTenantIdForUser] No tenantId found for user ${userId}`);
  return null;
}

export async function getTenantIdByUserId(userId: string): Promise<number | undefined> {
  const tenant = await db
    .select()
    .from(tenants)
    .where(eq(tenants.name, userId)); // Using name field for now, needs proper mapping
  return tenant[0]?.id;
}
