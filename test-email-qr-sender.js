// Script to test sending a real email with a QR code
require('dotenv').config();
const sgMail = require('@sendgrid/mail');

// Set API key if available
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.error('SENDGRID_API_KEY not found in environment variables');
  process.exit(1);
}

// Get the sender email from environment variables with validation
const fromEmail = process.env.SENDGRID_FROM_EMAIL;
if (!fromEmail) {
  console.error('SENDGRID_FROM_EMAIL not found in environment variables');
  process.exit(1);
}

// Generate a test confirmation code
const testConfirmationCode = `TEST${Date.now().toString().slice(-6)}`;

// Get the base URL
const baseUrl = process.env.HOST_URL || 'https://workspace.akashagarwal3.repl.co';

// Create the QR code URL
const qrCodeUrl = `${baseUrl}/api/qr-code/${encodeURIComponent(testConfirmationCode)}`;

// Create HTML email content
const htmlContent = `
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
      <p style="margin-top: 5px;">Confirmation #: ${testConfirmationCode}</p>
    </div>
    
    <div style="padding: 20px;">
      <p>This is a test email to verify QR code functionality in the Dock Optimizer system.</p>
      
      <div style="text-align: center; margin: 15px auto; background-color: #f0f9ff; padding: 15px; border-radius: 8px; border: 1px solid #b3d7ff; max-width: 320px;">
        <h3 style="color: #0066cc; margin-top: 0; text-align: center;">Express Check-In QR Code</h3>
        <div style="background-color: white; padding: 10px; border-radius: 5px; display: inline-block; margin-bottom: 10px; border: 1px solid #b3d7ff;">
          <img src="${qrCodeUrl}" 
               alt="Check-in QR Code" 
               style="width: 150px; height: 150px; display: block; margin: 0 auto;">
          <p style="margin: 5px 0 0; font-family: monospace; font-weight: bold; color: #0066cc; text-align: center;">
            ${testConfirmationCode}
          </p>
        </div>
        <div style="font-size: 13px; color: #333; text-align: left; margin-top: 10px;">
          <p style="margin: 0 0 5px; font-weight: bold;">How to use:</p>
          <ul style="margin: 0; padding-left: 20px;">
            <li>Present this QR code to dock staff upon arrival</li>
            <li>You can also scan it yourself to check in quickly</li>
            <li>If you can't see the QR code above, use your confirmation code: <strong>${testConfirmationCode}</strong></li>
          </ul>
        </div>
      </div>
      
      <div style="margin-top: 20px;">
        <p><strong>QR Code URL:</strong> ${qrCodeUrl}</p>
        <p>This URL should be directly accessible and should return a valid QR code image.</p>
      </div>
    </div>
    
    <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
      <p>This is a test message from Dock Optimizer QR Code Test.</p>
    </div>
  </div>
</body>
</html>
`;

// Email text version
const textContent = `
QR Code Test Email
Confirmation #: ${testConfirmationCode}

This is a test email to verify QR code functionality in the Dock Optimizer system.

Express Check-In QR Code
How to use:
- Present this QR code to dock staff upon arrival
- You can also scan it yourself to check in quickly
- If you can't see the QR code, use your confirmation code: ${testConfirmationCode}

QR Code URL: ${qrCodeUrl}
This URL should be directly accessible and should return a valid QR code image.

This is a test message from Dock Optimizer QR Code Test.
`;

// Prompt for email recipient
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

readline.question('Enter recipient email address: ', async (recipientEmail) => {
  readline.close();
  
  if (!recipientEmail || !recipientEmail.includes('@')) {
    console.error('Invalid email address provided');
    process.exit(1);
  }

  try {
    // Create email message
    const msg = {
      to: recipientEmail,
      from: fromEmail,
      subject: `Dock Optimizer QR Code Test - ${testConfirmationCode}`,
      text: textContent,
      html: htmlContent,
    };

    // Send the email
    console.log(`Sending test email to ${recipientEmail}...`);
    console.log(`Using QR Code URL: ${qrCodeUrl}`);
    
    const response = await sgMail.send(msg);
    
    console.log('Test email sent successfully!');
    console.log(`Status code: ${response[0].statusCode}`);
    console.log(`QR code confirmation code: ${testConfirmationCode}`);
    console.log(`QR code URL used: ${qrCodeUrl}`);
  } catch (error) {
    console.error('Error sending test email:');
    console.error(error);
    
    if (error.response) {
      console.error('Error details:');
      console.error(error.response.body);
    }
  }
});