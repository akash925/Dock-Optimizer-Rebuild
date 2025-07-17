#!/usr/bin/env node

/**
 * This script fixes the Vite HMR hostname issue by setting the correct hostname
 * before Vite starts. This is necessary because the vite.config.ts file uses
 * `new URL(import.meta.url).hostname` which returns null for file:// URLs.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Calculate the correct hostname for Replit
const REPL_SLUG = process.env.REPL_SLUG || 'workspace';
const REPL_OWNER = process.env.REPL_OWNER || 'akash225';
const correctHostname = `${REPL_SLUG}.${REPL_OWNER}.replit.dev`;

console.log('🔧 Fixing Vite HMR hostname...');
console.log(`   Expected hostname: ${correctHostname}`);

// Read the current vite.config.ts
const viteConfigPath = path.join(__dirname, 'vite.config.ts');
let viteConfig = fs.readFileSync(viteConfigPath, 'utf8');

// Replace the problematic line with more precise matching
const problematicLine = 'host: new URL(import.meta.url).hostname,';
const fixedLine = `host: "${correctHostname}",`;

// Check for different possible formats and fix them
let wasFixed = false;
const patterns = [
  { search: 'host: new URL(import.meta.url).hostname,', replace: `host: "${correctHostname}",` },
  { search: '            host: new URL(import.meta.url).hostname,', replace: `            host: "${correctHostname}",` },
  { search: 'host: undefined,', replace: `host: "${correctHostname}",` },
  { search: '            host: undefined,', replace: `            host: "${correctHostname}",` }
];

for (const pattern of patterns) {
  if (viteConfig.includes(pattern.search)) {
    viteConfig = viteConfig.replace(pattern.search, pattern.replace);
    wasFixed = true;
    console.log(`✅ Fixed pattern: ${pattern.search}`);
    break;
  }
}

if (wasFixed) {
  fs.writeFileSync(viteConfigPath, viteConfig);
  console.log('✅ Fixed Vite HMR hostname configuration');
} else {
  console.log('ℹ️  No matching patterns found. Current config:');
  // Show relevant lines for debugging
  const lines = viteConfig.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('host:') && lines[i].includes('hmr')) {
      console.log(`Line ${i + 1}: ${lines[i].trim()}`);
    }
  }
}

// Verify the fix
const updatedConfig = fs.readFileSync(viteConfigPath, 'utf8');
if (updatedConfig.includes(correctHostname)) {
  console.log('✅ Hostname fix verified');
} else {
  console.log('⚠️  Hostname fix may not have been applied correctly');
}