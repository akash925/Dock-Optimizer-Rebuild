import React, { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, QrCode, Barcode, RefreshCw, Copy, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface BarcodeGeneratorProps {
  assetId: number;
  assetName: string;
  currentBarcode: string | null;
  onSave: (barcode: string) => Promise<void>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BarcodeGenerator({
  assetId,
  assetName,
  currentBarcode,
  onSave,
  open,
  onOpenChange,
}: BarcodeGeneratorProps) {
  const [barcodeType, setBarcodeType] = useState<'barcode' | 'qrcode'>('barcode');
  const [barcodeValue, setBarcodeValue] = useState<string>(currentBarcode || `HANZO-${assetId}`);
  const [barcodeFormat, setBarcodeFormat] = useState<string>('CODE128');
  const [saving, setSaving] = useState<boolean>(false);
  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (barcodeType === 'barcode' && barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, barcodeValue, {
          format: barcodeFormat,
          width: 2,
          height: 100,
          displayValue: true,
          fontSize: 20,
          margin: 10,
          background: '#ffffff',
        });
      } catch (error) {
        console.error('Error generating barcode:', error);
      }
    }
  }, [barcodeType, barcodeValue, barcodeFormat]);

  const handleBarcodeValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBarcodeValue(e.target.value);
  };

  const handleFormatChange = (format: string) => {
    setBarcodeFormat(format);
  };

  const generateRandomBarcode = () => {
    // Generate a random barcode with prefix
    const randomPart = Math.floor(10000 + Math.random() * 90000);
    const newBarcode = `H${randomPart}`;
    setBarcodeValue(newBarcode);
  };

  const saveBarcode = async () => {
    if (!barcodeValue) {
      toast({
        title: 'Error',
        description: 'Barcode value cannot be empty',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      await onSave(barcodeValue);
      toast({
        title: 'Success',
        description: 'Barcode saved successfully',
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving barcode:', error);
      toast({
        title: 'Error',
        description: 'Failed to save barcode',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const downloadBarcode = () => {
    if (barcodeType === 'barcode' && barcodeRef.current) {
      const svg = barcodeRef.current;
      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
        const pngFile = canvas.toDataURL('image/png');
        
        // Download PNG
        const downloadLink = document.createElement('a');
        downloadLink.download = `barcode-${assetName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`;
        downloadLink.href = pngFile;
        downloadLink.click();
      };
      
      img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
    } else if (barcodeType === 'qrcode') {
      // For QR code download
      const svg = document.getElementById('qrcode-svg');
      if (svg) {
        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx?.drawImage(img, 0, 0);
          const pngFile = canvas.toDataURL('image/png');
          
          // Download PNG
          const downloadLink = document.createElement('a');
          downloadLink.download = `qrcode-${assetName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`;
          downloadLink.href = pngFile;
          downloadLink.click();
        };
        
        img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
      }
    }
  };

  const copyBarcode = () => {
    navigator.clipboard.writeText(barcodeValue).then(
      () => {
        toast({
          title: 'Copied!',
          description: 'Barcode copied to clipboard',
        });
      },
      (err) => {
        console.error('Could not copy text: ', err);
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Barcode Generator</DialogTitle>
          <DialogDescription>
            Generate and assign a barcode or QR code for asset tracking
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={barcodeType} onValueChange={(v) => setBarcodeType(v as 'barcode' | 'qrcode')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="barcode" className="flex items-center justify-center">
              <Barcode className="mr-2 h-4 w-4" />
              Barcode
            </TabsTrigger>
            <TabsTrigger value="qrcode" className="flex items-center justify-center">
              <QrCode className="mr-2 h-4 w-4" />
              QR Code
            </TabsTrigger>
          </TabsList>
          
          <div className="py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="barcode-value">Barcode Value</Label>
                <div className="flex space-x-2">
                  <Input
                    id="barcode-value"
                    value={barcodeValue}
                    onChange={handleBarcodeValueChange}
                    placeholder="Enter barcode value"
                  />
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={generateRandomBarcode}
                    title="Generate Random Barcode"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={copyBarcode}
                    title="Copy Barcode Value"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {barcodeType === 'barcode' && (
                <div className="space-y-2">
                  <Label htmlFor="barcode-format">Barcode Format</Label>
                  <Select value={barcodeFormat} onValueChange={handleFormatChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CODE128">Code 128</SelectItem>
                      <SelectItem value="CODE39">Code 39</SelectItem>
                      <SelectItem value="EAN13">EAN-13</SelectItem>
                      <SelectItem value="EAN8">EAN-8</SelectItem>
                      <SelectItem value="UPC">UPC</SelectItem>
                      <SelectItem value="ITF14">ITF-14</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
          
          <TabsContent value="barcode" className="space-y-4">
            <div className="flex justify-center bg-white p-4 rounded-md border">
              {barcodeValue ? (
                <svg ref={barcodeRef}></svg>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  Enter a value to generate barcode
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="qrcode" className="space-y-4">
            <div className="flex justify-center bg-white p-4 rounded-md border">
              {barcodeValue ? (
                <QRCodeSVG
                  id="qrcode-svg"
                  value={barcodeValue}
                  size={200}
                  level="H" // High error correction
                  includeMargin={true}
                  className="mx-auto"
                />
              ) : (
                <div className="text-center text-gray-500 py-8">
                  Enter a value to generate QR code
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
        
        <div className="flex justify-between mt-4">
          <Button 
            variant="outline"
            onClick={downloadBarcode}
            disabled={!barcodeValue}
            className="flex items-center"
          >
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
          <div className="space-x-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={saveBarcode} disabled={saving || !barcodeValue}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving
                </>
              ) : (
                'Save & Assign'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}