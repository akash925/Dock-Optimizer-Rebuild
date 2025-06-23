// server/storage/organizations.ts

import { db } from "../db";
import { organizationUsers } from "@shared/schema";

export async function getOrganizationNameForTenant(
  tenantId: number
): Promise<string | null> {
  const [org] = await db
    .select({ name: organizationUsers.name })
    .from(organizationUsers)
    .where(organizationUsers.id.eq(tenantId));
  return org?.name ?? null;
}
