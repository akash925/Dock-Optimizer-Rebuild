import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Scan, Loader2 } from 'lucide-react';
import { BarcodeScanner } from './barcode-scanner';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';

interface BarcodeScanButtonProps {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function BarcodeScanButton({ variant = 'ghost', size = 'icon' }: BarcodeScanButtonProps) {
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [searching, setSearching] = useState(false);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const handleOpenScanner = () => {
    setOpen(true);
    setScanning(true);
  };

  const handleBarcodeDetected = async (barcode: string) => {
    setScanning(false);
    setSearching(true);
    
    try {
      // Search for an asset with this barcode
      const response = await apiRequest('GET', `/api/company-assets/barcode/search?barcode=${encodeURIComponent(barcode)}`);
      
      if (response.ok) {
        const asset = await response.json();
        
        if (asset && asset.id) {
          toast({
            title: 'Asset Found',
            description: `Found asset: ${asset.name}`,
          });
          
          // Navigate to the asset edit page
          setOpen(false);
          navigate(`/company-assets/assets/${asset.id}/edit`);
        } else {
          toast({
            title: 'No Asset Found',
            description: `No asset found with barcode: ${barcode}`,
            variant: 'destructive',
          });
          setSearching(false);
        }
      } else {
        toast({
          title: 'Search Failed',
          description: 'Failed to search for asset by barcode',
          variant: 'destructive',
        });
        setSearching(false);
      }
    } catch (error) {
      console.error('Error searching for asset by barcode:', error);
      toast({
        title: 'Search Error',
        description: 'An error occurred while searching for the asset',
        variant: 'destructive',
      });
      setSearching(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setScanning(false);
    setSearching(false);
  };

  return (
    <>
      <Button 
        variant={variant}
        size={size}
        onClick={handleOpenScanner}
        aria-label="Scan Barcode"
        title="Scan Barcode"
      >
        <Scan className="h-5 w-5" />
      </Button>
      
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          {scanning ? (
            <BarcodeScanner onDetected={handleBarcodeDetected} onClose={handleClose} />
          ) : searching ? (
            <div className="flex flex-col items-center justify-center p-6 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-center">Searching for asset...</p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}