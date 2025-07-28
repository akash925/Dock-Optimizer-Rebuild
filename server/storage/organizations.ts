// server/storage/organizations.ts

import { db } from "../db.js";
import { organizationUsers } from "@shared/schema";

export async function getOrganizationNameForTenant(
  tenantId: number
): Promise<string | null> {
  const [org] = await db
    .select({ name: (organizationUsers as any).name })
    .from(organizationUsers)
    .where((organizationUsers as any).id.eq(tenantId));
  return org?.name ?? null;
}
