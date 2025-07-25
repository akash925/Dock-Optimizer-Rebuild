// server/storage/modules.ts

import { db } from "../db";
import { organizationModules } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function getModulesForOrganization(organizationId: number): Promise<string[]> {
  const records = await db
    .select({ moduleName: organizationModules.moduleName })
    .from(organizationModules)
    .where(eq(organizationModules.organizationId, organizationId));

  return records.map((r: any) => r.moduleName);
}
