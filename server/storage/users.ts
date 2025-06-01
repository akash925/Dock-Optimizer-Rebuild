// server/storage/users.ts

import bcrypt from "bcryptjs";
import { db } from "../db";
import { users } from "@shared/schema";

type User = {
  id: number;
  username: string;
  password: string;
  tenantId: number;
  role?: string;
};

export async function getUserByUsername(username: string): Promise<User | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(users.username.eq(username));
  return user || null;
}

export async function validatePassword(
  user: { password: string },
  password: string
): Promise<boolean> {
  return bcrypt.compare(password, user.password);
}