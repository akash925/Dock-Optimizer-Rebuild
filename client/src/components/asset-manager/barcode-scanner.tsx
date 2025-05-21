import React, { useEffect, useRef, useState } from 'react';
import Quagga from 'quagga';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Camera, 
  XCircle, 
  RotateCcw, 
  SwitchCamera, 
  Lightbulb 
} from 'lucide-react';

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
  const [isMobile, setIsMobile] = useState(false);
  const [torch, setTorch] = useState(false);
  const [lastDetection, setLastDetection] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Check if we're on a mobile device
    setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    
    const setupScanner = async () => {
      try {
        // Get available cameras
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setCameras(videoDevices);
        
        if (videoDevices.length > 0) {
          // Use rear camera by default if available
          const rearCamera = videoDevices.find(
            device => device.label.toLowerCase().includes('back') || 
                     device.label.toLowerCase().includes('rear')
          );
          
          const defaultCamera = rearCamera ? rearCamera.deviceId : videoDevices[0].deviceId;
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

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    
    try {
      const track = streamRef.current.getVideoTracks()[0];
      const capabilities = track.getCapabilities();
      
      // Check if torch is supported
      if (capabilities.torch) {
        const newTorchState = !torch;
        await track.applyConstraints({ advanced: [{ torch: newTorchState }] });
        setTorch(newTorchState);
      }
    } catch (error) {
      console.error('Error toggling torch:', error);
    }
  };

  const startScanner = (deviceId: string) => {
    if (!videoRef.current) return;
    
    setLoading(true);
    
    // Save camera settings
    if (localStorage) {
      localStorage.setItem('lastUsedCameraId', deviceId);
    }
    
    Quagga.init(
      {
        inputStream: {
          name: 'Live',
          type: 'LiveStream',
          target: videoRef.current,
          constraints: {
            deviceId: deviceId,
            width: { min: 1280 },
            height: { min: 720 },
            facingMode: 'environment', // prefer rear camera
          },
        },
        locator: {
          patchSize: 'medium',
          halfSample: true,
        },
        numOfWorkers: navigator.hardwareConcurrency || 2,
        frequency: 10, // Increase scan frequency
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
          multiple: false,
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
        
        // Store reference to media stream for torch functionality
        const videoElem = videoRef.current?.querySelector('video');
        if (videoElem && videoElem.srcObject instanceof MediaStream) {
          streamRef.current = videoElem.srcObject;
        }
        
        Quagga.start();
      }
    );

    Quagga.onDetected((result) => {
      if (result && result.codeResult && result.codeResult.code) {
        const code = result.codeResult.code;
        console.log('Barcode detected:', code);
        
        // Set last detection for preview
        setLastDetection(code);
        
        // Confirm detection is valid
        if (code.length > 4) {
          // Stop scanning after detection
          stopScanner();
          
          // Send the detected barcode to the parent component
          onDetected(code);
        }
      }
    });
  };

  const stopScanner = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    Quagga.stop();
    setScannerActive(false);
    setTorch(false);
  };

  const handleCameraChange = (deviceId: string) => {
    stopScanner();
    setActiveCamera(deviceId);
    startScanner(deviceId);
  };
  
  const switchCamera = () => {
    if (cameras.length <= 1) return;
    
    const currentIndex = cameras.findIndex(camera => camera.deviceId === activeCamera);
    const nextIndex = (currentIndex + 1) % cameras.length;
    handleCameraChange(cameras[nextIndex].deviceId);
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
        <h3 className="text-lg font-medium">Scan Barcode</h3>
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
            className={`bg-black rounded-lg w-full h-[70vh] max-h-[70vh] overflow-hidden relative ${loading ? 'flex items-center justify-center' : ''}`}
          >
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-2 text-white">
                <Camera className="h-8 w-8 animate-pulse" />
                <p>Activating camera...</p>
              </div>
            ) : (
              <>
                {/* Scanner guide overlay */}
                <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
                  <div className="w-3/4 h-1/3 border-2 border-white/70 rounded-lg shadow-lg">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary -translate-x-1 -translate-y-1 rounded-tl-lg"></div>
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary translate-x-1 -translate-y-1 rounded-tr-lg"></div>
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary -translate-x-1 translate-y-1 rounded-bl-lg"></div>
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary translate-x-1 translate-y-1 rounded-br-lg"></div>
                  </div>
                </div>
                
                {/* Last detected value */}
                {lastDetection && (
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                    <Badge variant="secondary" className="bg-black/70 text-white px-3 py-1">
                      {lastDetection}
                    </Badge>
                  </div>
                )}
              </>
            )}
          </div>
          
          {/* Camera controls */}
          <div className="flex items-center justify-between gap-2">
            {/* Camera switcher - Shown as icon button on mobile */}
            {cameras.length > 1 && (
              isMobile ? (
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={switchCamera}
                  disabled={!scannerActive || loading}
                  className="flex-shrink-0"
                  title="Switch Camera"
                >
                  <SwitchCamera className="h-5 w-5" />
                </Button>
              ) : (
                <select
                  id="camera-select"
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm flex-1"
                  value={activeCamera || ''}
                  onChange={(e) => handleCameraChange(e.target.value)}
                  disabled={!scannerActive || loading}
                >
                  {cameras.map((camera) => (
                    <option key={camera.deviceId} value={camera.deviceId}>
                      {camera.label || `Camera ${camera.deviceId.substr(0, 5)}...`}
                    </option>
                  ))}
                </select>
              )
            )}
            
            {/* Spacer when only one control is present */}
            {cameras.length <= 1 && <div className="flex-1"></div>}
            
            {/* Instructions */}
            <p className="text-center text-sm text-muted-foreground flex-1">
              Point your camera at a barcode
            </p>
            
            {/* Flash toggle - Only on mobile */}
            {isMobile && (
              <Button
                variant={torch ? "secondary" : "outline"}
                size="icon"
                onClick={toggleTorch}
                disabled={!scannerActive || loading}
                className="flex-shrink-0"
                title={torch ? "Turn Flashlight Off" : "Turn Flashlight On"}
              >
                <Lightbulb className={`h-5 w-5 ${torch ? 'text-yellow-500' : ''}`} />
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}