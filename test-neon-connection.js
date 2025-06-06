#!/usr/bin/env node
import { Pool } from '@neondatabase/serverless';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('🧪 Testing Neon Database Connection...\n');

async function testNeonConnection() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    console.log('Please set your Neon connection string in .env file or Replit Secrets');
    return;
  }

  // Check if connection string looks like Neon format
  if (!process.env.DATABASE_URL.includes('neon.tech')) {
    console.warn('⚠️  DATABASE_URL doesn\'t appear to be a Neon connection string');
    console.log('Expected format: postgresql://username:password@ep-xyz.neon.tech/database?sslmode=require');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('🔌 Connecting to Neon database...');
    const client = await pool.connect();
    
    // Test basic connection
    const timeResult = await client.query('SELECT NOW() as current_time');
    console.log('✅ Database connected successfully!');
    console.log(`🕒 Current time: ${timeResult.rows[0].current_time}`);
    
    // Test if we can query basic PostgreSQL info
    const versionResult = await client.query('SELECT version()');
    console.log(`🐘 PostgreSQL Version: ${versionResult.rows[0].version.split(' ')[1]}`);
    
    // Test if our schema exists (check for one of our main tables)
    try {
      const tableCheck = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('companies', 'facilities', 'appointments')
        ORDER BY table_name
      `);
      
      if (tableCheck.rows.length > 0) {
        console.log('✅ Database schema found:');
        tableCheck.rows.forEach(row => {
          console.log(`   📋 Table: ${row.table_name}`);
        });
      } else {
        console.log('⚠️  No application tables found. You may need to run migrations:');
        console.log('   npm run db:push');
      }
    } catch (error) {
      console.log('⚠️  Could not check tables (this is normal for new databases)');
    }
    
    client.release();
    
    console.log('\n🎉 Neon connection test completed successfully!');
    console.log('Your application should work properly with this database.');
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    
    // Provide helpful debugging info
    if (error.message.includes('password authentication failed')) {
      console.log('\n🔧 Troubleshooting:');
      console.log('1. Check your username and password in the connection string');
      console.log('2. Verify the connection string was copied correctly from Neon dashboard');
    } else if (error.message.includes('connect ENOTFOUND')) {
      console.log('\n🔧 Troubleshooting:');
      console.log('1. Check your internet connection');
      console.log('2. Verify the hostname in your connection string');
      console.log('3. Ensure your connection string includes the correct region');
    } else if (error.message.includes('SSL')) {
      console.log('\n🔧 Troubleshooting:');
      console.log('1. Ensure your connection string includes ?sslmode=require');
      console.log('2. Check if your network blocks SSL connections');
    }
    
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the test
testNeonConnection().catch(console.error); 