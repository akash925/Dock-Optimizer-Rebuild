// CREATE FACILITY HOURS TABLE - IMMEDIATE FIX
// Run this in Replit to fix External Booking time slots

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

import dotenv from 'dotenv';
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found. Run this in Replit where DATABASE_URL is set.');
  process.exit(1);
}

import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('neon.tech') ? { rejectUnauthorized: false } : false
});

console.log('🔧 CREATING FACILITY HOURS TABLE - EXTERNAL BOOKING FIX\n');

async function createFacilityHoursTable() {
  try {
    const client = await pool.connect();
    
    console.log('📊 Creating facility_hours table...');
    
    // Create the table
    await client.query(`
      CREATE TABLE IF NOT EXISTS facility_hours (
        id SERIAL PRIMARY KEY,
        facility_id INTEGER NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
        monday_open TIME,
        monday_close TIME,
        tuesday_open TIME,
        tuesday_close TIME,
        wednesday_open TIME,
        wednesday_close TIME,
        thursday_open TIME,
        thursday_close TIME,
        friday_open TIME,
        friday_close TIME,
        saturday_open TIME,
        saturday_close TIME,
        sunday_open TIME,
        sunday_close TIME,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(facility_id)
      )
    `);
    
    console.log('✅ facility_hours table created successfully');
    
    // Get all facilities
    const facilitiesResult = await client.query('SELECT id, name FROM facilities ORDER BY id');
    const facilities = facilitiesResult.rows;
    
    console.log(`📍 Found ${facilities.length} facilities to configure hours for:`);
    facilities.forEach(f => console.log(`  - Facility ${f.id}: ${f.name}`));
    
    // Insert default hours for all facilities
    console.log('\n⏰ Creating default hours (6 AM - 6 PM, Mon-Fri, 8 AM - 4 PM Saturday)...');
    
    for (const facility of facilities) {
      const insertResult = await client.query(`
        INSERT INTO facility_hours (
          facility_id, 
          monday_open, monday_close,
          tuesday_open, tuesday_close,
          wednesday_open, wednesday_close,
          thursday_open, thursday_close,
          friday_open, friday_close,
          saturday_open, saturday_close,
          sunday_open, sunday_close
        ) VALUES (
          $1, 
          '06:00', '18:00',
          '06:00', '18:00', 
          '06:00', '18:00',
          '06:00', '18:00',
          '06:00', '18:00',
          '08:00', '16:00',
          null, null
        )
        ON CONFLICT (facility_id) DO NOTHING
        RETURNING facility_id
      `, [facility.id]);
      
      if (insertResult.rows.length > 0) {
        console.log(`  ✅ Created hours for ${facility.name}`);
      } else {
        console.log(`  ℹ️  Hours already exist for ${facility.name}`);
      }
    }
    
    // Verify the fix
    console.log('\n📋 Verifying facility hours configuration...');
    const hoursResult = await client.query(`
      SELECT fh.facility_id, f.name, fh.monday_open, fh.monday_close
      FROM facility_hours fh
      JOIN facilities f ON fh.facility_id = f.id
      ORDER BY fh.facility_id
    `);
    
    console.log(`✅ Successfully configured hours for ${hoursResult.rows.length} facilities:`);
    hoursResult.rows.forEach(row => {
      console.log(`  Facility ${row.facility_id} (${row.name}): ${row.monday_open} - ${row.monday_close}`);
    });
    
    client.release();
    
    console.log('\n🎉 EXTERNAL BOOKING FIX COMPLETE!');
    console.log('✅ facility_hours table created and populated');
    console.log('✅ All facilities now have operating hours');
    console.log('✅ External booking should now load time slots');
    
    console.log('\n🔄 NEXT STEPS:');
    console.log('1. Restart your Replit server');
    console.log('2. Test External Booking - should now show available time slots');
    console.log('3. Test Door Manager - should show 14 docks for Organization 5');
    
    return true;
    
  } catch (error) {
    console.error('❌ Error creating facility hours table:', error);
    return false;
  }
}

async function runTableCreation() {
  console.log('🚀 Running facility_hours table creation...\n');
  
  const success = await createFacilityHoursTable();
  
  if (success) {
    console.log('\n🎯 TABLE CREATION SUCCESS!');
    console.log('Both Door Manager and External Booking should now work properly.');
  } else {
    console.log('\n❌ TABLE CREATION FAILED');
    console.log('Check the error messages above for troubleshooting.');
  }
  
  await pool.end();
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTableCreation().catch(console.error);
} 