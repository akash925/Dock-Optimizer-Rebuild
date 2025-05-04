import { Request, Response } from 'express';
import QRCode from 'qrcode';

export async function registerQrCodeRoutes(app: any) {
  /**
   * Generate QR code from provided data
   * This endpoint generates a QR code image based on the provided data query parameter
   */
  app.get('/api/qr-code', async (req: Request, res: Response) => {
    try {
      // Get the data to encode in the QR code
      const data = req.query.data as string;
      
      if (!data) {
        return res.status(400).json({ error: 'Missing required data parameter' });
      }
      
      // Set content type to PNG image
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
      
      // Generate QR code directly to the response
      const options = {
        errorCorrectionLevel: 'H' as const, // High error correction level
        margin: 1,
        width: 200,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      };
      
      await QRCode.toFileStream(res, data, options);
    } catch (error) {
      console.error('Error generating QR code:', error);
      res.status(500).json({ error: 'Failed to generate QR code' });
    }
  });
  
  /**
   * Generate QR code for appointment confirmation
   * This endpoint generates a QR code specifically for appointment check-in
   */
  app.get('/api/qr-code/:code', async (req: Request, res: Response) => {
    try {
      const code = req.params.code;
      
      if (!code) {
        return res.status(400).json({ error: 'Missing confirmation code' });
      }
      
      // Construct the check-in URL
      const baseUrl = process.env.HOST_URL || `${req.protocol}://${req.get('host')}`;
      const checkInUrl = `${baseUrl}/driver-check-in?code=${code}`;
      
      // Set content type to PNG image
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
      
      // Generate QR code directly to the response
      const options = {
        errorCorrectionLevel: 'H', // High error correction level
        margin: 1,
        width: 200,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      };
      
      QRCode.toFileStream(res, checkInUrl, options);
    } catch (error) {
      console.error('Error generating QR code for confirmation code:', error);
      res.status(500).json({ error: 'Failed to generate QR code' });
    }
  });
  
  console.log('QR code routes registered');
}