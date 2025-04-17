import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useState } from 'react';
import { Schedule } from '@shared/schema';
import { format } from 'date-fns';
import { Printer, Download } from 'lucide-react';

interface AppointmentQRCodeProps {
  schedule: Schedule;
  confirmationCode?: string;
  isExternal?: boolean;
}

export default function AppointmentQRCode({ schedule, confirmationCode, isExternal = false }: AppointmentQRCodeProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Generate confirmation code if not provided (e.g. "ABC123")
  const code = confirmationCode || `${schedule.id.toString().padStart(6, '0')}`;
  
  // Base URL for the check-in page - would be a real URL in production
  const baseUrl = window.location.origin;
  const checkInUrl = `${baseUrl}/driver-check-in?code=${code}`;
  
  const handlePrint = () => {
    setIsGenerating(true);
    
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print QR code');
      setIsGenerating(false);
      return;
    }
    
    // Get start time in a readable format
    const startTime = new Date(schedule.startTime);
    const formattedStartTime = format(startTime, 'MMM dd, yyyy h:mm a');
    
    // Generate the HTML with the QR code for printing
    const printContent = `
      <html>
        <head>
          <title>Appointment QR Code</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              max-width: 600px;
              margin: 0 auto;
              text-align: center;
            }
            h1 {
              font-size: 24px;
              margin-bottom: 5px;
            }
            h2 {
              font-size: 20px;
              margin-top: 0;
              margin-bottom: 20px;
              color: #555;
            }
            .code {
              font-size: 32px;
              letter-spacing: 2px;
              margin: 15px 0;
              font-weight: bold;
            }
            .details {
              margin: 20px 0;
              text-align: left;
              padding-left: 50px;
            }
            .details p {
              margin: 5px 0;
              font-size: 14px;
            }
            .footer {
              margin-top: 20px;
              font-size: 12px;
              color: #777;
            }
            .qrcode {
              margin: 20px auto;
            }
            @media print {
              button {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <h1>Dock Appointment Check-In</h1>
          <h2>Hanzo Logistics</h2>
          
          <div class="qrcode">
            ${document.getElementById('appointment-qr-code')?.innerHTML || ''}
          </div>
          
          <div class="code">${code}</div>
          
          <div class="details">
            <p><strong>Appointment Date:</strong> ${formattedStartTime}</p>
            <p><strong>Customer:</strong> ${schedule.customerName || 'Not specified'}</p>
            <p><strong>Carrier:</strong> ${schedule.carrierName || 'Not specified'}</p>
            <p><strong>Truck Number:</strong> ${schedule.truckNumber || 'Not specified'}</p>
            <p><strong>Type:</strong> ${schedule.type?.toUpperCase() || 'Not specified'}</p>
          </div>
          
          <div class="footer">
            <p>Please scan this code at the facility or enter the confirmation code to check in.</p>
            <p>For questions, contact the facility office.</p>
          </div>
          
          <button onclick="window.print(); window.close();" style="margin-top: 30px; padding: 10px 20px;">
            Print QR Code
          </button>
        </body>
      </html>
    `;
    
    // Write to the new window and print
    printWindow.document.open();
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    // Reset state after operation
    setIsGenerating(false);
  };
  
  const handleDownload = () => {
    setIsGenerating(true);
    
    try {
      // Get QR code SVG element
      const svgElement = document.getElementById('appointment-qr-code')?.querySelector('svg');
      if (!svgElement) {
        throw new Error('QR code SVG not found');
      }
      
      // Convert SVG to string
      const svgData = new XMLSerializer().serializeToString(svgElement);
      
      // Create a Blob with the SVG data
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml' });
      
      // Create a download link
      const link = document.createElement('a');
      link.href = URL.createObjectURL(svgBlob);
      link.download = `appointment-qr-code-${code}.svg`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading QR code:', error);
      alert('Failed to download QR code');
    } finally {
      setIsGenerating(false);
    }
  };
  
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Appointment QR Code</CardTitle>
        <CardDescription>
          Scan this code for check-in at the facility
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <div id="appointment-qr-code" className="mb-4">
          <QRCodeSVG 
            value={checkInUrl}
            size={200}
            includeMargin={true}
            level="H"
          />
        </div>
        <div className="text-2xl font-bold tracking-wider mb-4">
          {code}
        </div>
        <div className="text-sm text-muted-foreground text-center">
          This QR code can be scanned on arrival for quick check-in
        </div>
      </CardContent>
      <CardFooter className="flex justify-center gap-4">
        <Button 
          variant="outline" 
          onClick={handlePrint}
          disabled={isGenerating}
          className="flex items-center gap-2"
        >
          <Printer className="w-4 h-4" />
          Print
        </Button>
        <Button 
          onClick={handleDownload}
          disabled={isGenerating}
          className="flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Download
        </Button>
      </CardFooter>
    </Card>
  );
}