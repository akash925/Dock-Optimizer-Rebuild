import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

async function testNeonConnection() {
  console.log("🔍 TESTING NEON DATABASE CONNECTION");
  console.log("=".repeat(50));
  
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error("❌ DATABASE_URL environment variable not set");
    process.exit(1);
  }
  
  if (connectionString.includes('localhost')) {
    console.error("❌ Still using localhost database!");
    console.error("Please update .env file with Neon connection string");
    process.exit(1);
  }
  
  if (!connectionString.includes('neon.tech')) {
    console.error("❌ DATABASE_URL doesn't appear to be a Neon database");
    process.exit(1);
  }
  
  console.log("✅ DATABASE_URL appears to be Neon format");
  console.log(`📍 Host: ${connectionString.split('@')[1]?.split('/')[0] || 'unknown'}`);
  
  try {
    const pool = new Pool({ connectionString });
    const result = await pool.query('SELECT NOW() as current_time, version() as db_version');
    
    console.log("✅ Connection successful!");
    console.log(`🕐 Database time: ${result.rows[0].current_time}`);
    console.log(`📦 Database version: ${result.rows[0].db_version.split(' ')[0]}`);
    
    // Test if users table exists
    const usersCheck = await pool.query(`
      SELECT COUNT(*) as user_count 
      FROM users
    `);
    
    console.log(`👥 Users in Neon database: ${usersCheck.rows[0].user_count}`);
    
    // Check for password_reset_tokens table
    try {
      await pool.query('SELECT COUNT(*) FROM password_reset_tokens LIMIT 1');
      console.log("✅ password_reset_tokens table exists");
    } catch (error: any) {
      if (error.code === '42P01') {
        console.log("⚠️  password_reset_tokens table does not exist - needs migration");
      } else {
        console.log("❌ Error checking password_reset_tokens table:", error.message);
      }
    }
    
    await pool.end();
    
    console.log("\n🎉 NEON DATABASE CONNECTION VERIFIED!");
    console.log("Your development environment is now connected to production data!");
    
  } catch (error: any) {
    console.error("❌ Connection failed:", error.message);
    console.error("Please check your DATABASE_URL in .env file");
    process.exit(1);
  }
}

testNeonConnection(); 