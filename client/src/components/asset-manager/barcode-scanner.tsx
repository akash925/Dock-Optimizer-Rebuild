import React, { useEffect, useRef, useState } from 'react';
import Quagga from 'quagga';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, X, Camera } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface BarcodeScannerProps {
  onDetected: (barcode: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [activeCamera, setActiveCamera] = useState<string | null>(null);

  useEffect(() => {
    // Request camera access and enumerate devices
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(() => {
        return navigator.mediaDevices.enumerateDevices();
      })
      .then(devices => {
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setCameras(videoDevices);
        if (videoDevices.length > 0) {
          setActiveCamera(videoDevices[0].deviceId);
        }
      })
      .catch(error => {
        console.error('Error accessing camera:', error);
        toast({
          title: 'Camera Access Error',
          description: 'Unable to access camera. Please ensure you have granted camera permissions.',
          variant: 'destructive',
        });
        setLoading(false);
      });

    return () => {
      // Clean up Quagga when component unmounts
      Quagga.stop();
    };
  }, []);

  useEffect(() => {
    if (!scannerRef.current || !activeCamera) return;

    const initQuagga = () => {
      if (scannerRef.current) {
        Quagga.init(
          {
            inputStream: {
              name: 'Live',
              type: 'LiveStream',
              target: scannerRef.current,
              constraints: {
                deviceId: activeCamera,
                width: 640,
                height: 480,
                facingMode: 'environment', // Prefer back camera
              },
            },
            locator: {
              patchSize: 'medium',
              halfSample: true,
            },
            numOfWorkers: navigator.hardwareConcurrency || 4,
            decoder: {
              readers: [
                'code_128_reader',
                'ean_reader',
                'ean_8_reader',
                'code_39_reader',
                'code_39_vin_reader',
                'codabar_reader',
                'upc_reader',
                'upc_e_reader',
                'i2of5_reader',
                'code_93_reader',
                'code_32_reader', // for pharmaceuticals
              ],
            },
            locate: true,
          },
          (err) => {
            if (err) {
              console.error('Error initializing Quagga:', err);
              toast({
                title: 'Scanner Error',
                description: 'Failed to initialize barcode scanner.',
                variant: 'destructive',
              });
              setLoading(false);
              return;
            }
            setLoading(false);
            Quagga.start();
          }
        );

        // Set up detection callback
        Quagga.onDetected((result) => {
          if (result.codeResult.code) {
            // Provide haptic feedback if available
            if (navigator.vibrate) {
              navigator.vibrate(200);
            }
            
            // Play success sound
            const successAudio = new Audio('/assets/beep.mp3');
            successAudio.play().catch(e => console.log('Audio play error:', e));
            
            onDetected(result.codeResult.code);
            Quagga.stop();
          }
        });
      }
    };

    initQuagga();

    return () => {
      Quagga.stop();
    };
  }, [activeCamera, onDetected]);

  const handleCameraChange = (deviceId: string) => {
    Quagga.stop();
    setActiveCamera(deviceId);
    setLoading(true);
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="flex flex-row justify-between items-center">
        <CardTitle>Scan Barcode</CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </CardHeader>
      <CardContent>
        <div 
          ref={scannerRef} 
          className="relative overflow-hidden rounded-md w-full aspect-video bg-gray-100"
        >
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
        </div>
      </CardContent>
      {cameras.length > 1 && (
        <CardFooter className="flex-col gap-2">
          <div className="text-sm font-medium">Select Camera:</div>
          <div className="flex gap-2 flex-wrap">
            {cameras.map((camera, index) => (
              <Button
                key={camera.deviceId}
                variant={activeCamera === camera.deviceId ? "default" : "outline"}
                size="sm"
                onClick={() => handleCameraChange(camera.deviceId)}
              >
                <Camera className="mr-2 h-4 w-4" />
                Camera {index + 1}
              </Button>
            ))}
          </div>
        </CardFooter>
      )}
    </Card>
  );
}