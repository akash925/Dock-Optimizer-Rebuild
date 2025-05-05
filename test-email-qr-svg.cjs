// Note: This is a CommonJS module to test the QR code functionality
// Using server functions directly since we want to test just the QR code generation

// Instead of importing, we'll define our own basic QR code SVG generator for testing
const QRCode = require('qrcode');

/**
 * Generate a QR code SVG for testing our email notification QR code system
 * This is a simplified version of the function in notifications.ts
 */
async function generateQRCodeSVG(confirmationCode, baseUrl) {
  try {
    // Create check-in URL
    const checkInUrl = `${baseUrl}/driver-check-in?code=${confirmationCode}`;
    
    // Generate QR code as SVG
    const qrSvg = await QRCode.toString(checkInUrl, {
      type: 'svg',
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 200,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    // Create email-compatible SVG wrapper
    const svgContent = `
      <div style="text-align: center; margin: 25px 0;">
        <div style="display: inline-block; background-color: white; padding: 15px; border: 1px solid #ddd; border-radius: 5px;">
          <h3 style="margin-top: 0; margin-bottom: 10px; color: #333;">Express Check-in</h3>
          ${qrSvg}
          <p style="margin-top: 10px; margin-bottom: 0; font-size: 12px; color: #666;">
            Confirmation Code: ${confirmationCode}<br>
            <span style="font-size: 11px;">Scan with your phone to check in</span>
          </p>
        </div>
      </div>
    `;
    
    return svgContent;
  } catch (error) {
    console.error('Error generating QR code SVG:', error);
    return null;
  }
}

const fs = require('fs');

// Create a simple test function
async function testQRCodeGeneration() {
  try {
    console.log('Starting QR code SVG generation test...');
    
    // Test with a sample confirmation code
    const testCode = 'TEST' + Math.floor(Math.random() * 10000);
    const testHost = 'https://dockoptimizer.replit.app';
    
    console.log(`Generating QR code for confirmation code: ${testCode}`);
    console.log(`Using base URL: ${testHost}`);
    
    // Call the QR code generation function
    const svgOutput = await generateQRCodeSVG(testCode, testHost);
    
    // Check if the result contains SVG
    if (svgOutput && svgOutput.includes('<svg')) {
      console.log('✅ QR code SVG generated successfully!');
      console.log(`SVG size: ${svgOutput.length} characters`);
      console.log('Preview of SVG:\n', svgOutput.substring(0, 150) + '...');
      
      // Create a simple HTML file to view the QR code
      const htmlOutput = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR Code Test</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .container { max-width: 800px; margin: 0 auto; }
          h1 { color: #333; }
          .info { margin-bottom: 20px; }
          .code { font-family: monospace; background: #f5f5f5; padding: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>QR Code Test</h1>
          <div class="info">
            <p><strong>Test Code:</strong> <span class="code">${testCode}</span></p>
            <p><strong>URL:</strong> <span class="code">${testHost}/driver-check-in?code=${testCode}</span></p>
          </div>
          ${svgOutput}
        </div>
      </body>
      </html>
      `;
      
      // Save the HTML file in public directory so it can be accessed via the web server
      fs.writeFileSync('public/test-qr-code.html', htmlOutput);
      console.log('✅ Generated HTML file with QR code: public/test-qr-code.html');
    } else {
      console.log('❌ Failed to generate QR code SVG or SVG not found in output');
      console.log('Output:', svgOutput);
    }
    
    console.log('\nTest completed!');
  } catch (error) {
    console.error('Error during test:', error);
  }
}

// Run the test
testQRCodeGeneration();