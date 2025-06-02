// server/storage/tenants.ts

import { db } from "../db";
import { users, tenants } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function getTenantIdForUser(userId: number): Promise<number | null> {
  const [user] = await db
    .select({ tenantId: users.tenantId })
    .from(users)
    .where(eq(users.id, userId));
  return user?.tenantId ?? null;
}

export async function getTenantIdByUserId(userId: string): Promise<number | undefined> {
  const tenant = await db
    .select()
    .from(tenants)
    .where(eq(tenants.name, userId)); // Using name field for now, needs proper mapping
  return tenant[0]?.id;
}
