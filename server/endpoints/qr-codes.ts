import QRCode from 'qrcode';

/**
 * Generate a QR code SVG for appointment check-in
 * @param confirmationCode The appointment confirmation code
 * @param baseUrl The base URL of the application
 * @returns HTML/SVG content with the QR code
 */
export async function generateQRCodeSVG(confirmationCode: string, baseUrl: string): Promise<string> {
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
    return '';
  }
}

/**
 * Generate a data URI for a QR code image as fallback for email clients that don't support SVG
 * @param confirmationCode The appointment confirmation code
 * @param baseUrl The base URL of the application
 * @returns Data URI string for QR code image
 */
export async function generateQRCodeDataURL(confirmationCode: string, baseUrl: string): Promise<string> {
  try {
    const checkInUrl = `${baseUrl}/driver-check-in?code=${confirmationCode}`;
    
    // Generate QR code as data URL
    const dataUrl = await QRCode.toDataURL(checkInUrl, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 200,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    return dataUrl;
  } catch (error) {
    console.error('Error generating QR code data URL:', error);
    return '';
  }
}

/**
 * Register QR code endpoints for testing and production use
 */
export function registerQrCodeRoutes(app: any) {
  // Test endpoint to display a QR code
  app.get('/api/qr-code-test', async (req, res) => {
    try {
      // Generate a random test code
      const testCode = 'TEST' + Math.floor(Math.random() * 10000);
      const baseUrl = process.env.HOST_URL || 'https://dockoptimizer.replit.app';
      
      // Generate QR code SVG
      const svgContent = await generateQRCodeSVG(testCode, baseUrl);
      
      // Create a simple HTML page to display the QR code
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
            <p><strong>URL:</strong> <span class="code">${baseUrl}/driver-check-in?code=${testCode}</span></p>
          </div>
          ${svgContent}
        </div>
      </body>
      </html>
      `;
      
      // Send HTML response
      res.setHeader('Content-Type', 'text/html');
      res.send(htmlOutput);
    } catch (error) {
      console.error('Error in QR code test endpoint:', error);
      res.status(500).send('Error generating QR code test');
    }
  });
  
  // Endpoint that generates a QR code SVG for a specific confirmation code
  // This is used by the email templates and driver check-in page
  app.get('/api/qr-code/:confirmationCode', async (req, res) => {
    try {
      const confirmationCode = req.params.confirmationCode;
      if (!confirmationCode) {
        return res.status(400).send('Missing confirmation code');
      }
      
      const baseUrl = process.env.HOST_URL || 'https://dockoptimizer.replit.app';
      const checkInUrl = `${baseUrl}/driver-check-in?code=${encodeURIComponent(confirmationCode)}`;
      
      // Log the request for debugging
      console.log(`[QR] Generating QR code for confirmation code: ${confirmationCode}`);
      console.log(`[QR] Check-in URL: ${checkInUrl}`);
      
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
      
      // Set headers
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
      
      // Send SVG directly
      res.send(qrSvg);
    } catch (error) {
      console.error('Error generating QR code SVG for API:', error);
      res.status(500).send('Error generating QR code');
    }
  });
  
  // Endpoint that generates a QR code as a PNG image for email clients that don't support SVG
  app.get('/api/qr-code-image/:confirmationCode', async (req, res) => {
    try {
      const confirmationCode = req.params.confirmationCode;
      if (!confirmationCode) {
        return res.status(400).send('Missing confirmation code');
      }
      
      const baseUrl = process.env.HOST_URL || 'https://dockoptimizer.replit.app';
      const checkInUrl = `${baseUrl}/driver-check-in?code=${encodeURIComponent(confirmationCode)}`;
      
      // Generate QR code as PNG buffer
      const qrBuffer = await QRCode.toBuffer(checkInUrl, {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 200,
        type: 'png'
      });
      
      // Set headers
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
      
      // Send PNG buffer
      res.send(qrBuffer);
    } catch (error) {
      console.error('Error generating QR code PNG for API:', error);
      res.status(500).send('Error generating QR code');
    }
  });
}