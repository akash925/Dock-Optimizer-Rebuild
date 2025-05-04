// Test script for email QR code functionality
const fs = require('fs');
const path = require('path');
const { createServer } = require('http');

// Setup a basic express-like app to handle the request
const server = createServer((req, res) => {
  if (req.url.startsWith('/api/qr-code/')) {
    // Extract the confirmation code from URL
    const code = req.url.split('/api/qr-code/')[1];
    console.log(`Generating QR code for confirmation code: ${code}`);
    
    // Respond with a sample image (a simple 1x1 px transparent GIF)
    // In a real implementation, this would generate a QR code
    res.writeHead(200, { 'Content-Type': 'image/gif' });
    // This is a 1x1 transparent GIF
    const image = Buffer.from('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64');
    res.end(image);
    return;
  }
  
  // Default response
  res.writeHead(404);
  res.end('Not found');
});

// Start server on random port
const PORT = 3421;
server.listen(PORT, () => {
  console.log(`Test server listening on port ${PORT}`);
  
  // Generate HTML with QR code URL
  const html = generateTestEmail(`http://localhost:${PORT}`);
  
  // Save the HTML to a file
  fs.writeFileSync('test-qr-email.html', html);
  console.log(`Test email HTML saved to test-qr-email.html`);
  
  // Open the file in a browser (if running on a desktop)
  console.log(`To test, open test-qr-email.html in a browser and check if QR code displays`);
  
  // After a few seconds, shut down the server
  setTimeout(() => {
    console.log('Test complete. Shutting down server.');
    server.close();
  }, 30000); // Keep the server running for 30 seconds for testing
});

function generateTestEmail(baseUrl) {
  const confirmationCode = 'TEST123';
  const qrCodeUrl = `${baseUrl}/api/qr-code/${encodeURIComponent(confirmationCode)}`;
  
  return `
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
}