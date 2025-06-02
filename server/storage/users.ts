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
  // Handle bcrypt hashes (starts with $2b$)
  if (user.password.startsWith('$2b$')) {
    return bcrypt.compare(password, user.password);
  }
  
  // Handle other hash formats or plain text for existing users
  // For development/testing purposes, also check direct match
  if (user.password === password) {
    return true;
  }
  
  // Try bcrypt comparison anyway in case it's a different bcrypt variant
  try {
    return await bcrypt.compare(password, user.password);
  } catch {
    return false;
  }
}