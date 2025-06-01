// server/storage/features.ts

import { db } from "../db";
import { featureFlags } from "@shared/schema";

export async function isFeatureEnabledForTenant(
  tenantId: number,
  featureKey: string
): Promise<boolean> {
  const [flag] = await db
    .select()
    .from(featureFlags)
    .where(
      featureFlags.tenantId.eq(tenantId).and(
        featureFlags.featureKey.eq(featureKey)
      )
    );

  return Boolean(flag?.enabled);
}
