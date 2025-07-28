#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

console.log('🔧 Fixing import paths...');

const files = glob.sync('dist/server/**/*.js');
let totalFiles = 0;
let totalReplacements = 0;

for (const file of files) {
  let content = readFileSync(file, 'utf8');
  let hasChanges = false;

  // Fix shared/schema imports specifically
  const schemaRegex = /from\s+['"]([^'"]*shared\/schema)['"]/g;
  content = content.replace(schemaRegex, (match, path) => {
    totalReplacements++;
    hasChanges = true;
    return `from '${path}.js'`;
  });

  // Fix other shared imports
  const sharedRegex = /from\s+['"]([^'"]*shared\/[^'"]*)['"]/g;
  content = content.replace(sharedRegex, (match, path) => {
    if (!path.endsWith('.js')) {
      totalReplacements++;
      hasChanges = true;
      return `from '${path}.js'`;
    }
    return match;
  });

  // Fix double .js extensions
  content = content.replace(/\.js\.js/g, '.js');

  if (hasChanges) {
    writeFileSync(file, content);
    totalFiles++;
  }
}

console.log(`✅ Fixed ${totalReplacements} import paths in ${totalFiles} files`); 