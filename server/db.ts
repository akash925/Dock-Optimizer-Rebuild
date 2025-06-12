import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Create dummy exports to prevent import errors when DATABASE_URL is not set
let pool: Pool | null = null;
let db: any = null;

if (process.env.DATABASE_URL) {
  try {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzle(pool, { schema });
  } catch (error) {
    console.warn("Failed to connect to database, using memory storage:", error);
  }
} else {
  console.warn("DATABASE_URL not set. Using memory storage for development.");
}

export { pool, db };