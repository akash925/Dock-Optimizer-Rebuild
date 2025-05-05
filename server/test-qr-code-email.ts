/**
 * Test script to verify email QR code generation
 */
import { generateQRCodeSVG } from './endpoints/qr-codes';

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

if (require.main === module) {
  console.log('Running QR code email test...');
  testEmailQRCode().then(result => {
    console.log('Test complete with code:', result.testCode);
    // Write to a test file for inspection
    const fs = require('fs');
    fs.writeFileSync('test-email-qr.html', result.html);
    console.log('Test email saved to test-email-qr.html');
  }).catch(err => {
    console.error('Error running test:', err);
  });
}

export default testEmailQRCode;