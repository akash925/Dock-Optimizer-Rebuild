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