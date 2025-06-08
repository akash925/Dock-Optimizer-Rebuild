// Production Fix for Availability Date Format Error
// Run this in Replit console: node fix-availability-date-error.js
// This script patches the availability service to handle invalid dates gracefully

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Import production dependencies
import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';

console.log('🚀 FIXING AVAILABILITY DATE FORMAT ERROR\n');

// Path to the availability service file
const availabilityFilePath = 'server/src/services/availability.ts';

// Check if file exists
if (!fs.existsSync(availabilityFilePath)) {
  console.error('❌ availability.ts file not found at:', availabilityFilePath);
  process.exit(1);
}

// Read the current file
let fileContent = fs.readFileSync(availabilityFilePath, 'utf8');

// Define the patches to apply
const patches = [
  {
    name: 'Add safe date formatting function',
    search: `import { format, parse, addMinutes, startOfDay, endOfDay, addDays, isValid } from 'date-fns';`,
    replace: `import { format, parse, addMinutes, startOfDay, endOfDay, addDays, isValid } from 'date-fns';

// Safe date formatting function to prevent "Invalid time value" errors
function safeFormat(date: Date | null | undefined, formatStr: string, fallback = 'Invalid Date'): string {
  if (!date || !isValid(date)) {
    console.warn('[AvailabilityService] Invalid date encountered:', date);
    return fallback;
  }
  try {
    return format(date, formatStr);
  } catch (error) {
    console.error('[AvailabilityService] Date formatting error:', error);
    return fallback;
  }
}`
  },
  {
    name: 'Replace format calls with safeFormat',
    search: `console.log(\`  Parsed time (local): \${format(operatingStartDateTime, 'HH:mm')} - \${format(operatingEndDateTime, 'HH:mm')}\`);`,
    replace: `console.log(\`  Parsed time (local): \${safeFormat(operatingStartDateTime, 'HH:mm')} - \${safeFormat(operatingEndDateTime, 'HH:mm')}\`);`
  },
  {
    name: 'Fix break time format calls',
    search: `console.log(\`  Parsed time (local): \${breakStartDateTime ? format(breakStartDateTime, 'HH:mm') : 'null'} - \${breakEndDateTime ? format(breakEndDateTime, 'HH:mm') : 'null'}\`);`,
    replace: `console.log(\`  Parsed time (local): \${safeFormat(breakStartDateTime, 'HH:mm', 'null')} - \${safeFormat(breakEndDateTime, 'HH:mm', 'null')}\`);`
  },
  {
    name: 'Add date validation before parsing',
    search: `operatingStartDateTime = parse(
    \`\${facilityTZDateStr} \${operatingStartTimeStr}\`, 
    'yyyy-MM-dd HH:mm', 
    new Date()
  );`,
    replace: `try {
    operatingStartDateTime = parse(
      \`\${facilityTZDateStr} \${operatingStartTimeStr}\`, 
      'yyyy-MM-dd HH:mm', 
      new Date()
    );
    
    if (!isValid(operatingStartDateTime)) {
      throw new Error(\`Invalid operating start time: \${facilityTZDateStr} \${operatingStartTimeStr}\`);
    }
  } catch (error) {
    console.error('[AvailabilityService] Error parsing operating start time:', error);
    throw new Error(\`Failed to parse operating hours for facility \${facilityId}\`);
  }`
  },
  {
    name: 'Add validation for operating end time',
    search: `operatingEndDateTime = parse(
    \`\${facilityTZDateStr} \${operatingEndTimeStr}\`, 
    'yyyy-MM-dd HH:mm', 
    new Date()
  );`,
    replace: `try {
    operatingEndDateTime = parse(
      \`\${facilityTZDateStr} \${operatingEndTimeStr}\`, 
      'yyyy-MM-dd HH:mm', 
      new Date()
    );
    
    if (!isValid(operatingEndDateTime)) {
      throw new Error(\`Invalid operating end time: \${facilityTZDateStr} \${operatingEndTimeStr}\`);
    }
  } catch (error) {
    console.error('[AvailabilityService] Error parsing operating end time:', error);
    throw new Error(\`Failed to parse operating hours for facility \${facilityId}\`);
  }`
  },
  {
    name: 'Add validation for facility timezone date',
    search: `const facilityTZDateStr = format(dateInFacilityTZ, 'yyyy-MM-dd');`,
    replace: `if (!isValid(dateInFacilityTZ)) {
    throw new Error(\`Invalid date for facility timezone conversion: \${date}\`);
  }
  const facilityTZDateStr = safeFormat(dateInFacilityTZ, 'yyyy-MM-dd');
  
  if (facilityTZDateStr === 'Invalid Date') {
    throw new Error(\`Failed to format date for facility \${facilityId}: \${date}\`);
  }`
  }
];

// Apply patches
let patchesApplied = 0;

for (const patch of patches) {
  console.log(`🔧 Applying patch: ${patch.name}`);
  
  if (fileContent.includes(patch.search)) {
    fileContent = fileContent.replace(patch.search, patch.replace);
    patchesApplied++;
    console.log(`  ✅ Applied successfully`);
  } else {
    console.log(`  ⚠️  Pattern not found (may already be patched)`);
  }
}

// Write the patched file
if (patchesApplied > 0) {
  // Create backup first
  const backupPath = `${availabilityFilePath}.backup-${Date.now()}`;
  fs.writeFileSync(backupPath, fs.readFileSync(availabilityFilePath, 'utf8'));
  console.log(`📦 Created backup: ${backupPath}`);
  
  // Write patched version
  fs.writeFileSync(availabilityFilePath, fileContent);
  console.log(`✅ Applied ${patchesApplied} patches to availability.ts`);
  
  console.log('\n🎉 AVAILABILITY DATE ERROR FIXES APPLIED!');
  console.log('The availability API should now handle invalid dates gracefully.');
  console.log('🔄 Please restart your server to apply changes.');
} else {
  console.log('\n✅ No patches needed - file may already be updated.');
}

console.log('\n🏁 Availability fix script completed.'); 