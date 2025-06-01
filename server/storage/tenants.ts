// server/storage/tenants.ts

import { db } from "../db";
import { users } from "@shared/schema";

export async function getTenantIdForUser(userId: number): Promise<number | null> {
  const [user] = await db
    .select({ tenantId: users.tenantId })
    .from(users)
    .where(users.id.eq(userId));
  return user?.tenantId ?? null;
}
