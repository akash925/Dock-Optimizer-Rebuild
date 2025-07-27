import { db } from "./db.js.js.js";
import { roles, type RoleRecord, type InsertRoleRecord } from "@shared/schema";
import { eq } from "drizzle-orm";

// This file contains methods for the DatabaseStorage class for Role operations

export async function getRole(id: number): Promise<RoleRecord | undefined> {
  const [role] = await db.select().from(roles).where(eq(roles.id, id));
  return role;
}

export async function getRoleByName(name: string): Promise<RoleRecord | undefined> {
  const [role] = await db.select().from(roles).where(eq(roles.name, name));
  return role;
}

export async function getRoles(): Promise<RoleRecord[]> {
  return await db.select().from(roles);
}

export async function createRole(role: InsertRoleRecord): Promise<RoleRecord> {
  const [createdRole] = await db.insert(roles).values(role).returning();
  return createdRole;
}