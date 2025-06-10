/**
 * Simple QR Code Generator for Email Embedding
 * Generates base64 data URLs for QR codes
 */

const QRCode = require('qrcode');

/**
 * Generate a QR code as a base64 data URL
 * @param {string} text - Text to encode in QR code
 * @param {object} options - QR code options
 * @returns {Promise<string>} Base64 data URL
 */
async function generateQRCodeBase64(text, options = {}) {
  try {
    const defaultOptions = {
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 200,
      ...options
    };

    // Generate QR code as data URL
    const qrDataURL = await QRCode.toDataURL(text, defaultOptions);
    
    console.log(`[QRGenerator] Generated QR code for: ${text.substring(0, 50)}...`);
    return qrDataURL;
  } catch (error) {
    console.error('[QRGenerator] Error generating QR code:', error);
    // Return a fallback simple text if QR generation fails
    return `data:text/plain;base64,${Buffer.from('QR Code Generation Failed').toString('base64')}`;
  }
}

/**
 * Generate a QR code as SVG string
 * @param {string} text - Text to encode in QR code
 * @param {object} options - QR code options
 * @returns {Promise<string>} SVG string
 */
async function generateQRCodeSVG(text, options = {}) {
  try {
    const defaultOptions = {
      type: 'svg',
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 200,
      ...options
    };

    const qrSVG = await QRCode.toString(text, defaultOptions);
    
    console.log(`[QRGenerator] Generated QR SVG for: ${text.substring(0, 50)}...`);
    return qrSVG;
  } catch (error) {
    console.error('[QRGenerator] Error generating QR SVG:', error);
    return '<svg><text>QR Code Error</text></svg>';
  }
}

module.exports = {
  generateQRCodeBase64,
  generateQRCodeSVG
}; 