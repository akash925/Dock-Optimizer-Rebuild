#!/usr/bin/env tsx

import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import { join } from 'path';

/**
 * Simple codemod to replace process.env.NODE_ENV with import.meta.env.MODE
 * in client-side TypeScript/JavaScript files
 */

async function replaceProcessEnvInClientFiles() {
  console.log('🔍 Finding client-side files with process.env references...');
  
  // Find all TypeScript/JavaScript files in client directory
  const files = await glob('client/src/**/*.{ts,tsx}', { 
    cwd: process.cwd(),
    absolute: true 
  });
  
  let totalReplacements = 0;
  let filesModified = 0;

  for (const filePath of files) {
    try {
      const content = readFileSync(filePath, 'utf-8');
      
      // Replace process.env.NODE_ENV with import.meta.env.MODE
      let newContent = content.replace(
        /process\.env\.NODE_ENV/g, 
        'import.meta.env.MODE'
      );
      
      // Check if any replacements were made
      const replacementCount = (content.match(/process\.env\.NODE_ENV/g) || []).length;
      
      if (replacementCount > 0) {
        writeFileSync(filePath, newContent, 'utf-8');
        console.log(`✅ ${filePath}: ${replacementCount} replacements`);
        totalReplacements += replacementCount;
        filesModified++;
      }
    } catch (error) {
      console.error(`❌ Error processing ${filePath}:`, error);
    }
  }
  
  console.log(`\n🎉 Migration complete!`);
  console.log(`📁 Files modified: ${filesModified}`);
  console.log(`🔄 Total replacements: ${totalReplacements}`);
}

// Run the migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  replaceProcessEnvInClientFiles().catch(console.error);
}

export { replaceProcessEnvInClientFiles }; 