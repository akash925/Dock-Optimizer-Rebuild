import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Allow development mode without database for memory storage
let pool: Pool | null = null;
let db: any = null;

if (!process.env.DATABASE_URL) {
  console.warn("DATABASE_URL not set. Database operations will fail. Using memory storage is recommended for development.");
  // Set to null - memory storage will be used instead
  pool = null;
  db = null;
} else {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle(pool, { schema });
}

export { pool, db };