import { db } from "../server/db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function main() {
  const [username, newPassword] = process.argv.slice(2);

  if (!username || !newPassword) {
    console.error("Usage: tsx scripts/reset-password.ts <username> <newPassword>");
    process.exit(1);
  }

  try {
    console.log(`Attempting to reset password for user: ${username}`);

    const user = await db.select().from(users).where(eq(users.username, username)).limit(1);

    if (!user.length) {
      console.error(`User not found: ${username}`);
      process.exit(1);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.update(users).set({ password: hashedPassword }).where(eq(users.username, username));

    console.log(`Password for user ${username} has been successfully reset.`);
    process.exit(0);
  } catch (error) {
    console.error("Error resetting password:", error);
    process.exit(1);
  }
}

main(); 