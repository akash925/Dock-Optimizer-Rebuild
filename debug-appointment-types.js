const { db } = require('./server/db');
const { appointmentTypes, schedules } = require('./shared/schema');

async function debugAppointmentTypes() {
  console.log('🔍 DEBUGGING APPOINTMENT TYPES AND TENANT ISOLATION');
  console.log('='.repeat(60));
  
  try {
    // Check appointment types
    const allAppointmentTypes = await db.select().from(appointmentTypes);
    console.log(`📊 Total appointment types: ${allAppointmentTypes.length}`);
    
    console.log('\n📋 APPOINTMENT TYPES BY TENANT:');
    allAppointmentTypes.forEach(type => {
      console.log(`   ID: ${type.id}, Name: ${type.name}, Tenant: ${type.tenantId}, Facility: ${type.facilityId}`);
    });
    
    // Check schedules
    const allSchedules = await db.select().from(schedules);
    console.log(`\n📅 Total schedules: ${allSchedules.length}`);
    
    console.log('\n📋 RECENT SCHEDULES:');
    const recentSchedules = allSchedules.slice(0, 10);
    recentSchedules.forEach(schedule => {
      console.log(`   ID: ${schedule.id}, AppType: ${schedule.appointmentTypeId}, Start: ${schedule.startTime}, Customer: ${schedule.customerName}`);
    });
    
    // Check tenant isolation
    console.log('\n🔒 TENANT ISOLATION CHECK:');
    const tenantGroups = {};
    
    for (const schedule of allSchedules) {
      const appointmentType = allAppointmentTypes.find(at => at.id === schedule.appointmentTypeId);
      if (appointmentType) {
        const tenantId = appointmentType.tenantId;
        if (!tenantGroups[tenantId]) {
          tenantGroups[tenantId] = [];
        }
        tenantGroups[tenantId].push(schedule);
      }
    }
    
    Object.keys(tenantGroups).forEach(tenantId => {
      console.log(`   Tenant ${tenantId}: ${tenantGroups[tenantId].length} schedules`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  process.exit(0);
}

debugAppointmentTypes(); 