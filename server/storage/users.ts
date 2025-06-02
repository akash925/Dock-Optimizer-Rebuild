// server/storage/users.ts

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "@shared/schema";

type User = typeof users.$inferSelect;

export async function getUserByUsername(username: string): Promise<User | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username));
  return user || null;
}

export async function validatePassword(
  user: { password: string },
  password: string
): Promise<boolean> {
  return bcrypt.compare(password, user.password);
}