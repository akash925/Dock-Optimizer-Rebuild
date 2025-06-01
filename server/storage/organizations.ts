// server/storage/organizations.ts

import { db } from "../db";
import { organizations } from "@shared/schema";

export async function getOrganizationNameForTenant(
  tenantId: number
): Promise<string | null> {
  const [org] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(organizations.id.eq(tenantId));
  return org?.name ?? null;
}
