const fs = require('fs');

// Read the routes.ts file
const routesPath = './server/routes.ts';
let content = fs.readFileSync(routesPath, 'utf8');

// Find the email setup function
const startPattern = 'const setupEmailField = () => {';
const endPattern = 'setupEmailField();';

// Check if the patterns exist
if (content.includes(startPattern) && content.includes(endPattern)) {
  // Get the start and end positions
  const startPos = content.indexOf(startPattern);
  const endPos = content.indexOf(endPattern) + endPattern.length;
  
  // Create the new content with the problematic section commented out
  const newContent = 
    content.substring(0, startPos) + 
    '// Email setup functionality temporarily disabled to fix server startup issues\n' +
    '// const setupEmailField = () => { ... }\n' +
    '// Disabled code here\n' +
    content.substring(endPos);
  
  // Write the fixed content back
  fs.writeFileSync(routesPath, newContent);
  console.log('Successfully disabled problematic email setup code');
} else {
  console.log('Could not find the email setup patterns in routes.ts');
}
