// Test script for QR code in emails using CommonJS
const fs = require('fs');
const QRCode = require('qrcode');

// Generate a QR code for a test confirmation code
async function generateQRCode() {
  const confirmationCode = 'TEST123';
  const baseUrl = 'http://localhost:3421'; // Replace with actual base URL if needed
  const checkInUrl = `${baseUrl}/driver-check-in?code=${confirmationCode}`;
  
  console.log('Generating QR code for URL:', checkInUrl);
  
  try {
    // Options for QR code generation
    const options = {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      margin: 1,
      width: 150,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    };
    
    // Generate a base64-encoded PNG image
    const qrCodeBase64 = await QRCode.toDataURL(checkInUrl, options);
    return qrCodeBase64;
  } catch (error) {
    console.error('Error generating QR code as base64:', error);
    return null;
  }
}

// Generate a test email with QR code
async function generateTestEmail(baseUrl = 'https://workspace.akashagarwal3.repl.co') {
  const confirmationCode = 'TEST123';
  const qrCodeUrl = `${baseUrl}/api/qr-code/${encodeURIComponent(confirmationCode)}`;
  
  console.log('Using QR code URL:', qrCodeUrl);
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Test QR Code Email</title>
</head>
<body>
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background-color: #00A86B; color: white; padding: 20px; text-align: center;">
      <h1 style="margin: 0;">QR Code Test Email</h1>
      <p style="margin-top: 5px;">Confirmation #: ${confirmationCode}</p>
    </div>
    
    <div style="padding: 20px;">
      <p>This is a test email to verify QR code rendering.</p>
      
      <div style="text-align: center; margin: 15px auto; background-color: #f0f9ff; padding: 15px; border-radius: 8px; border: 1px solid #b3d7ff; max-width: 320px;">
        <h3 style="color: #0066cc; margin-top: 0; text-align: center;">Express Check-In QR Code</h3>
        <div style="background-color: white; padding: 10px; border-radius: 5px; display: inline-block; margin-bottom: 10px; border: 1px solid #b3d7ff;">
          <img src="${qrCodeUrl}" 
               alt="Check-in QR Code" 
               style="width: 150px; height: 150px; display: block; margin: 0 auto;">
          <p style="margin: 5px 0 0; font-family: monospace; font-weight: bold; color: #0066cc; text-align: center;">
            ${confirmationCode}
          </p>
        </div>
        <div style="font-size: 13px; color: #333; text-align: left; margin-top: 10px;">
          <p style="margin: 0 0 5px; font-weight: bold;">How to use:</p>
          <ul style="margin: 0; padding-left: 20px;">
            <li>Present this QR code to dock staff upon arrival</li>
            <li>You can also scan it yourself to check in quickly</li>
            <li>If you can't see the QR code above, use your confirmation code: <strong>${confirmationCode}</strong></li>
          </ul>
        </div>
      </div>
      
      <div style="margin-top: 20px;">
        <p><strong>QR Code URL:</strong> ${qrCodeUrl}</p>
        <p>This URL should be directly accessible and should return a valid image.</p>
      </div>
    </div>
    
    <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
      <p>This is a test message from Dock Optimizer QR Code Test.</p>
    </div>
  </div>
</body>
</html>
  `;
  
  // Save the HTML to a file for viewing
  fs.writeFileSync('test-qr-email.html', html);
  console.log('HTML saved to test-qr-email.html');
  
  return {
    html,
    qrCodeUrl
  };
}

// Run the test
(async () => {
  try {
    const result = await generateTestEmail();
    console.log('Test email generated successfully!');
    console.log('Open test-qr-email.html in your browser to view it.');
    console.log('QR Code URL:', result.qrCodeUrl);
  } catch (error) {
    console.error('Error generating test email:', error);
  }
})();