#!/usr/bin/env node
// Test if we can build the frontend without the WebSocket hostname issue

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Testing frontend build without dev server...');

const build = spawn('doppler', ['run', '--config', 'prd', '--', 'vite', 'build', '--mode', 'production'], {
  cwd: __dirname,
  stdio: 'inherit',
  timeout: 30000 // 30 seconds timeout
});

build.on('exit', (code) => {
  if (code === 0) {
    console.log('✅ Frontend build successful');
    process.exit(0);
  } else {
    console.log(`❌ Frontend build failed with code ${code}`);
    process.exit(1);
  }
});

build.on('error', (err) => {
  console.error('❌ Build process error:', err);
  process.exit(1);
});

// Kill after timeout
setTimeout(() => {
  console.log('⏰ Build timeout reached, killing process...');
  build.kill('SIGTERM');
  process.exit(1);
}, 30000);