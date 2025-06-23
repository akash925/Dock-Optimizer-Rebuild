import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure Neon WebSocket for better connection handling
neonConfig.webSocketConstructor = ws;

// Enhanced connection configuration for Neon database
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

/* Environment-aware defaults */
const POOL_MAX =
  process.env.CI === 'true' || process.env.NEON_TIER === 'free' ? 2 :
  process.env.NODE_ENV === 'production' ? 5 : 3;

const POOL_IDLE =
  process.env.CI === 'true' || process.env.NEON_TIER === 'free' ? 10_000 : 15_000;

// CRITICAL: Enhanced Neon Pool configuration to prevent connection issues
const poolConfig = {
  connectionString,
  max: POOL_MAX,
  idleTimeoutMillis: POOL_IDLE,
  connectionTimeoutMillis: 10000, // 10 second connection timeout
  maxUses: 7500, // Limit connection reuse to prevent stale connections
  allowExitOnIdle: false, // Keep pool alive
};

// Create connection with enhanced error handling
let pool: Pool | null = null;
let db: ReturnType<typeof drizzle>;

// Connection health monitoring
let connectionHealthy = true;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;

function initializeConnection() {
  console.log('[DB] Initializing Neon database connection with enhanced configuration...');
  
  try {
    // Create new pool with enhanced config
    pool = new Pool(poolConfig);
    
    // Initialize Drizzle with the pool
    db = drizzle(pool, { schema });
    
    // Resilience: swallow expected Neon admin termination errors so the app keeps running
    (pool as any).on('error', (err: any) => {
      const expectedCodes = ['57P01', '57P02', '57P03'];
      if (err && expectedCodes.includes(err.code)) {
        console.warn(`[DB] ⚠️  Ignored expected pool error ${err.code}: ${err.message || err}`);
        return; // Do not crash the process
      }
      console.error('[DB] ❌ Unexpected database pool error:', err);
    });
    
    console.log('[DB] ✅ Database connection pool created successfully');
    console.log('[DB] 📊 Pool configuration:', {
      max: POOL_MAX,
      idleTimeout: `${POOL_IDLE}ms`,
      connectionTimeout: '10000ms'
    });
    
    // Test connection
    testConnection();
    
  } catch (error) {
    console.error('[DB] ❌ Failed to initialize database connection:', error);
    throw error;
  }
}

async function testConnection() {
  if (!pool) return;
  
  try {
    const result = await pool.query('SELECT 1 as test');
    console.log('[DB] ✅ Database connection test successful');
    connectionHealthy = true;
    reconnectAttempts = 0;
  } catch (error) {
    console.error('[DB] ❌ Database connection test failed:', error);
    connectionHealthy = false;
  }
}

// Health check function
export async function checkDatabaseHealth(): Promise<boolean> {
  if (!pool) {
    console.log('[DB] 🔄 Pool not initialized, attempting initialization...');
    try {
      initializeConnection();
      return connectionHealthy;
    } catch (error) {
      console.error('[DB] ❌ Failed to initialize pool during health check:', error);
      return false;
    }
  }
  
  try {
    await pool.query('SELECT 1 as health_check');
    connectionHealthy = true;
    reconnectAttempts = 0;
    return true;
  } catch (error: any) {
    console.error('[DB] ❌ Database health check failed:', error);
    connectionHealthy = false;
    
    // If connection was terminated, attempt recovery
    if (error.code === '57P01' || error.message?.includes('terminating connection')) {
      console.log('[DB] 🔄 Connection terminated detected, marking for recovery...');
    }
    
    return false;
  }
}

// Auto-recovery function
export async function ensureDatabaseConnection(): Promise<boolean> {
  if (connectionHealthy && pool) {
    return true;
  }
  
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error('[DB] ❌ Max reconnection attempts reached. Manual intervention required.');
    return false;
  }
  
  console.log(`[DB] 🔄 Attempting database reconnection (${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})...`);
  
  try {
    reconnectAttempts++;
    
    // Close existing pool if any
    if (pool) {
      try {
        await pool.end();
      } catch (endError) {
        console.log('[DB] ⚠️ Error ending existing pool (expected):', endError);
      }
      pool = null;
    }
    
    // Wait before reconnecting
    await new Promise(resolve => setTimeout(resolve, Math.min(1000 * reconnectAttempts, 5000)));
    
    // Recreate connection
    initializeConnection();
    
    // Test new connection
    await testConnection();
    
    if (connectionHealthy) {
      console.log('[DB] ✅ Database reconnection successful');
      return true;
    } else {
      throw new Error('Connection test failed after reconnection');
    }
    
  } catch (error) {
    console.error(`[DB] ❌ Reconnection attempt ${reconnectAttempts} failed:`, error);
    return false;
  }
}

// CRITICAL: Enhanced database wrapper with error handling and auto-recovery
export const safeQuery = async <T>(queryFn: () => Promise<T>): Promise<T> => {
  try {
    // Ensure connection is healthy before query
    if (!connectionHealthy || !pool) {
      console.log('[DB] 🔄 Connection unhealthy, attempting recovery...');
      const recovered = await ensureDatabaseConnection();
      if (!recovered) {
        throw new Error('Database connection could not be established');
      }
    }
    
    return await queryFn();
    
  } catch (error: any) {
    console.error('[DB] ❌ Query failed:', error);
    
    // Check if it's a connection termination error (Neon administrator command)
    if (error.code === '57P01' || error.message?.includes('terminating connection')) {
      console.log('[DB] 🔄 Connection terminated by administrator, attempting recovery...');
      connectionHealthy = false;
      
      const recovered = await ensureDatabaseConnection();
      if (recovered) {
        // Retry the query once after reconnection
        try {
          console.log('[DB] 🔄 Retrying query after successful reconnection...');
          return await queryFn();
        } catch (retryError) {
          console.error('[DB] ❌ Query retry after reconnection failed:', retryError);
          throw retryError;
        }
      }
    }
    
    throw error;
  }
};

// Initialize the connection
initializeConnection();

// Periodic health checks (every 3 minutes for Neon)
setInterval(async () => {
  const healthy = await checkDatabaseHealth();
  if (!healthy) {
    console.log('[DB] 🔄 Scheduled health check failed, attempting recovery...');
    await ensureDatabaseConnection();
  }
}, 3 * 60 * 1000);

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  console.log(`[DB] 🔄 Gracefully closing database connections (${signal})...`);
  try {
    if (pool) {
      await pool.end();
      pool = null;
    }
    console.log('[DB] ✅ Database connections closed successfully');
  } catch (error) {
    console.error('[DB] ❌ Error closing database connections:', error);
  }
  process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

export { db, pool };