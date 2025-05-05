/**
 * Test script to verify email QR code generation
 */
import { generateQRCodeSVG } from './endpoints/qr-codes';
import { writeFile } from 'fs/promises';

async function testEmailQRCode() {
  // Generate test code
  const testCode = 'TEST' + Math.floor(Math.random() * 10000);
  const host = process.env.HOST_URL || 'https://dockoptimizer.replit.app';

  // Generate QR code SVG directly
  const qrCodeSvgContent = await generateQRCodeSVG(testCode, host);
  
  // Generate an email HTML template with the QR code embedded
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2>QR Code Email Test</h2>
      <p>This is a test email template with a QR code embedded directly:</p>
      
      ${qrCodeSvgContent}
      
      <p>Confirmation Code: ${testCode}</p>
      <p>The QR code should be displayed above. If not, there might be an issue with SVG generation.</p>
    </div>
  `;
  
  console.log('HTML template generated:');
  console.log(html.substring(0, 200) + '...');
  
  return {
    testCode,
    html
  };
}

// Self-invoking function for when script is run directly
const runTest = async () => {
  console.log('Running QR code email test...');
  try {
    const result = await testEmailQRCode();
    console.log('Test complete with code:', result.testCode);
    // Write to a test file for inspection
    await writeFile('test-email-qr.html', result.html);
    console.log('Test email saved to test-email-qr.html');
  } catch (err) {
    console.error('Error running test:', err);
  }
};

// Run the test if this is the main module
if (import.meta.url.endsWith('/test-qr-code-email.ts')) {
  runTest();
}

export default testEmailQRCode;