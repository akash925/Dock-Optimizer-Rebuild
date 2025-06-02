// server/storage/users.ts

import bcrypt from "bcryptjs";
import { createHash } from "crypto";
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
  
  // Handle SHA-512 with salt format (161 characters)
  if (user.password.length === 161 && user.password.includes('.')) {
    const [hashedPassword, salt] = user.password.split('.');
    const testHash = createHash('sha512').update(password + salt).digest('hex');
    return testHash === hashedPassword;
  }
  
  // Handle direct password match for testing
  if (user.password === password) {
    return true;
  }
  
  // Try bcrypt comparison as fallback
  try {
    return await bcrypt.compare(password, user.password);
  } catch {
    return false;
  }
}