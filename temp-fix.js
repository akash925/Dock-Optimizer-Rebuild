#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the routes.ts file
const routesPath = path.join(process.cwd(), 'server', 'routes.ts');
let content = fs.readFileSync(routesPath, 'utf8');

// Simple replacement to make the function that uses await be async
content = content.replace(
  'const setupEmailField = () => {',
  'const setupEmailField = async () => {'
);

// Write the changes back
fs.writeFileSync(routesPath, content);
console.log('Fixed setupEmailField function to be async');
