// server/storage/modules.ts

import { db } from "../db";
import { modules } from "@shared/schema";

export async function getModulesForUser(userId: number): Promise<string[]> {
  const records = await db
    .select({ moduleKey: modules.moduleKey })
    .from(modules)
    .where(modules.userId.eq(userId));

  return records.map((r) => r.moduleKey);
}
