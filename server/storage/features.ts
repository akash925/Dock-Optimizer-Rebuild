// server/storage/features.ts

import { db } from "../db.js";
import { featureFlags } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export async function isFeatureEnabledForTenant(
  tenantId: number,
  featureKey: string
): Promise<boolean> {
  const [flag] = await db
    .select()
    .from(featureFlags)
          .where(
        and(
          eq(featureFlags.tenantId, tenantId),
          eq(featureFlags.module, featureKey)
        )
      );

  return Boolean(flag?.enabled);
}
