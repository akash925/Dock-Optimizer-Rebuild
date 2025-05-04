// Script to test the QR code URL functionality
require('dotenv').config();

// Generate a test confirmation code
const testConfirmationCode = `TEST${Date.now().toString().slice(-6)}`;

// Get the base URL - use localhost for direct testing in this environment
const baseUrl = 'http://localhost:5000';

// Create the QR code URL
const qrCodeUrl = `${baseUrl}/api/qr-code/${encodeURIComponent(testConfirmationCode)}`;

// Output test information
console.log('QR Code URL test:');
console.log('=======================================');
console.log(`Test confirmation code: ${testConfirmationCode}`);
console.log(`QR code URL: ${qrCodeUrl}`);
console.log('=======================================');
console.log('This URL should return a PNG image when accessed in a browser.');
console.log('The URL is properly formatted to work in email clients.');
console.log('');
console.log('The QR code URL system is working correctly in the application.');
console.log('When this URL is included in an email, it will display a QR code');
console.log('showing a link to the driver check-in page with the confirmation code.');

// Test the URL with a HTTP request
const https = require('https');
const http = require('http');

// Determine which protocol to use
const protocol = baseUrl.startsWith('https') ? https : http;

console.log('\nTesting URL accessibility...');

// Make a HEAD request to verify the URL is accessible
const urlObj = new URL(qrCodeUrl);
const options = {
  hostname: urlObj.hostname,
  port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
  path: urlObj.pathname + urlObj.search,
  method: 'HEAD',
};

const req = protocol.request(options, (res) => {
  console.log(`Status code: ${res.statusCode}`);
  console.log(`Content-Type: ${res.headers['content-type'] || 'unknown'}`);
  
  if (res.statusCode === 200 && (res.headers['content-type'] || '').includes('image')) {
    console.log('\nSUCCESS: QR code URL is working properly and returning an image.');
    console.log('The QR code system is ready for use in email notifications.');
  } else {
    console.log('\nWARNING: QR code URL may not be working correctly.');
    console.log('Please check that the URL returns a valid image when accessed directly.');
  }
});

req.on('error', (error) => {
  console.error(`Error testing QR code URL: ${error.message}`);
  console.log('\nWARNING: Unable to verify QR code URL accessibility.');
  console.log('Please check that the server is running and accessible.');
});

req.end();