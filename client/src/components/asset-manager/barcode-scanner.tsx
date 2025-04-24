import React, { useEffect, useRef, useState } from 'react';
import Quagga from 'quagga';
import { Button } from '@/components/ui/button';
import { Camera, XCircle, RotateCcw } from 'lucide-react';

interface BarcodeScannerProps {
  onDetected: (barcode: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLDivElement>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [activeCamera, setActiveCamera] = useState<string | null>(null);
  const [scannerActive, setScannerActive] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const setupScanner = async () => {
      try {
        // Get available cameras
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setCameras(videoDevices);
        
        if (videoDevices.length > 0) {
          // Use the first camera by default
          const defaultCamera = videoDevices[0].deviceId;
          setActiveCamera(defaultCamera);
          startScanner(defaultCamera);
        } else {
          console.error('No cameras found');
          setLoading(false);
        }
      } catch (error) {
        console.error('Error setting up barcode scanner:', error);
        if (error instanceof DOMException && error.name === 'NotAllowedError') {
          setPermissionDenied(true);
        }
        setLoading(false);
      }
    };

    setupScanner();

    return () => {
      stopScanner();
    };
  }, []);

  const startScanner = (deviceId: string) => {
    if (!videoRef.current) return;
    
    setLoading(true);
    
    Quagga.init(
      {
        inputStream: {
          name: 'Live',
          type: 'LiveStream',
          target: videoRef.current,
          constraints: {
            deviceId: deviceId,
            width: { min: 640 },
            height: { min: 480 },
            facingMode: 'environment', // prefer rear camera
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
          ],
        },
        locate: true,
      },
      (err) => {
        if (err) {
          console.error('Error initializing Quagga:', err);
          setLoading(false);
          if (err.name === 'NotAllowedError') {
            setPermissionDenied(true);
          }
          return;
        }
        
        setScannerActive(true);
        setLoading(false);
        
        Quagga.start();
      }
    );

    Quagga.onDetected((result) => {
      if (result && result.codeResult && result.codeResult.code) {
        const code = result.codeResult.code;
        console.log('Barcode detected:', code);
        
        // Stop scanning after detection
        stopScanner();
        
        // Send the detected barcode to the parent component
        onDetected(code);
      }
    });
  };

  const stopScanner = () => {
    Quagga.stop();
    setScannerActive(false);
  };

  const handleCameraChange = (deviceId: string) => {
    stopScanner();
    setActiveCamera(deviceId);
    startScanner(deviceId);
  };
  
  const handleRetry = () => {
    setPermissionDenied(false);
    if (activeCamera) {
      startScanner(activeCamera);
    } else if (cameras.length > 0) {
      startScanner(cameras[0].deviceId);
    }
  };

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-medium">Scan Asset Barcode</h3>
        <Button variant="ghost" size="icon" onClick={onClose} title="Close">
          <XCircle className="h-5 w-5" />
        </Button>
      </div>
      
      {permissionDenied ? (
        <div className="flex flex-col items-center justify-center p-6 space-y-4 text-center">
          <div className="bg-red-50 text-red-600 p-4 rounded-lg">
            <p className="font-semibold">Camera access denied</p>
            <p className="text-sm mt-1">Please allow camera access to scan barcodes</p>
          </div>
          <Button onClick={handleRetry} className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            Try Again
          </Button>
        </div>
      ) : (
        <>
          <div 
            ref={videoRef} 
            className={`bg-black rounded-lg w-full h-64 overflow-hidden relative ${loading ? 'flex items-center justify-center' : ''}`}
          >
            {loading && (
              <div className="flex flex-col items-center justify-center gap-2 text-white">
                <Camera className="h-8 w-8 animate-pulse" />
                <p>Activating camera...</p>
              </div>
            )}
          </div>
          
          {cameras.length > 1 && (
            <div className="mt-2">
              <label htmlFor="camera-select" className="block text-sm font-medium mb-1">
                Select Camera
              </label>
              <select
                id="camera-select"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={activeCamera || ''}
                onChange={(e) => handleCameraChange(e.target.value)}
                disabled={!scannerActive}
              >
                {cameras.map((camera) => (
                  <option key={camera.deviceId} value={camera.deviceId}>
                    {camera.label || `Camera ${camera.deviceId.substr(0, 5)}...`}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          <p className="text-center text-sm text-muted-foreground">
            Point your camera at a barcode to scan it
          </p>
        </>
      )}
    </div>
  );
}