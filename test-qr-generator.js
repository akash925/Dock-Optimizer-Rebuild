const QRCode = require('qrcode');
const fs = require('fs');

async function generateQRCode() {
  try {
    // Confirm QR code package is working
    const checkInUrl = 'https://dockoptimizer.replit.app/driver-check-in?code=TEST123';
    console.log('Generating QR code for URL:', checkInUrl);
    
    const options = {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 200,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    };
    
    // Generate a file-based QR code
    const qrPath = './test-qr-local.png';
    await QRCode.toFile(qrPath, checkInUrl, options);
    console.log('QR code generated successfully at', qrPath);
    
    // Generate base64 version for use in emails
    const qrDataUrl = await QRCode.toDataURL(checkInUrl, options);
    console.log('QR code as base64 (first 100 chars):', qrDataUrl.substring(0, 100) + '...');
    
    // Create a simple SVG version for direct embedding
    const svgString = await QRCode.toString(checkInUrl, {
      type: 'svg',
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 200
    });
    console.log('SVG QR code (first 100 chars):', svgString.substring(0, 100) + '...');
    
    fs.writeFileSync('./test-qr.svg', svgString);
    console.log('SVG QR code saved to test-qr.svg');
    
    return true;
  } catch (error) {
    console.error('Error generating QR code:', error);
    return false;
  }
}

generateQRCode();