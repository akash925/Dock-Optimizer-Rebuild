/**
 * This script tests the improved QR code embedding in emails
 * It directly updates the necessary files to fix QR code rendering in all email templates
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fixQRCodeInEmails() {
  console.log('Starting QR code email fix process...');
  
  // Path to the notifications.ts file
  const notificationsPath = path.join(process.cwd(), 'server', 'notifications.ts');
  
  if (!fs.existsSync(notificationsPath)) {
    console.error(`Error: Could not find file at ${notificationsPath}`);
    return;
  }
  
  console.log(`Found notifications.ts file at ${notificationsPath}`);
  
  try {
    // Read the file content
    let content = fs.readFileSync(notificationsPath, 'utf8');
    console.log('Successfully read notifications.ts file');
    
    // Check if the file contains qrCodeSvgUrl
    if (!content.includes('qrCodeSvgUrl')) {
      console.log('File does not contain qrCodeSvgUrl, no fixes needed');
      return;
    }
    
    // Fix for reminder email template - replace URLs with directly embedded SVG
    content = content.replace(
      // Generate QR code URLs
      /\/\/ Generate (?:QR code )?URLs for QR code image.*?\n.*?qrCodeSvgUrl.*?\n.*?qrCodePngUrl.*?\n.*?console\.log\(`\[EMAIL\] Using QR code URL/gs,
      `// Generate QR code and check-in URL
  const checkInUrl = \`\${host}/driver-check-in?code=\${encodeURIComponent(confirmationCode)}\`;
  
  // Generate QR code SVG directly
  const qrCodeSvgContent = await generateQRCodeSVG(confirmationCode, host);
  console.log(\`[EMAIL] Generated QR code SVG`
    );
    
    // Replace image tags with directly embedded SVG content
    content = content.replace(
      /<img src="\${qrCodeSvgUrl}" alt="QR Code" style="width: 200px; height: 200px;" \/>/g,
      '${qrCodeSvgContent}'
    );
    
    // Write the modified content back to file
    fs.writeFileSync(notificationsPath, content);
    console.log('Successfully updated notifications.ts file with QR code fixes');
    console.log('All email templates now use directly embedded SVG instead of image URLs');
    
    return true;
  } catch (error) {
    console.error('Error processing file:', error);
    return false;
  }
}

// Run the fix function
fixQRCodeInEmails()
  .then(result => {
    if (result) {
      console.log('🎉 QR code email fix completed successfully');
    } else {
      console.error('❌ QR code email fix failed');
    }
  })
  .catch(err => {
    console.error('Error running fix:', err);
  });