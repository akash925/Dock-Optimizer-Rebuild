import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

// Type declaration for Quagga to avoid module resolution issues
declare module 'quagga' {
  const quagga: any;
  export default quagga;
}
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';
import { 
  Camera, 
  XCircle, 
  RotateCcw, 
  SwitchCamera, 
  Lightbulb,
  Package,
  Calendar,
  CheckCircle
} from 'lucide-react';

interface BarcodeScannerProps {
  onDetected: (barcode: string) => void;
  onClose: () => void;
  mode?: 'asset' | 'appointment' | 'unified'; // New unified mode
}

export function BarcodeScanner({ onDetected, onClose, mode = 'unified' }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLDivElement>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [activeCamera, setActiveCamera] = useState<string | null>(null);
  const [scannerActive, setScannerActive] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [torch, setTorch] = useState(false);
  const [lastDetection, setLastDetection] = useState<string | null>(null);
  const [detectionType, setDetectionType] = useState<'asset' | 'appointment' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();
  const [, navigate] = useLocation();

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

  // Enhanced detection handler for unified scanning
  const handleDetection = async (code: string) => {
    if (isProcessing) return; // Prevent duplicate processing
    
    setIsProcessing(true);
    setLastDetection(code);
    
    try {
      console.log(`[UnifiedScanner] Detected code: ${code}`);
      
      // First try to identify if it's an appointment confirmation code
      let isAppointmentCode = false;
      let appointmentData: any = null;
      
      // Check if code looks like an appointment confirmation code
      if (mode === 'unified' || mode === 'appointment') {
        try {
          // Handle different confirmation code formats
          let searchCode = code;
          if (code.includes('?code=')) {
            const url = new URL(code);
            searchCode = url.searchParams.get('code') || code;
          }
          
          const response = await apiRequest('GET', `/api/schedules/confirmation/${searchCode}`);
          if (response.ok) {
            appointmentData = await response.json();
            isAppointmentCode = true;
            setDetectionType('appointment');
            
            toast({
              title: 'Appointment Found!',
              description: `Found appointment for ${appointmentData?.customerName || 'customer'}`,
              variant: 'default',
            });
            
            // Navigate to appointment details or call callback
            setTimeout(() => {
              navigate(`/schedules/${appointmentData?.id}`);
              onClose();
            }, 1500);
            
            return;
          }
        } catch (error) {
          console.log('[UnifiedScanner] Not an appointment code, trying asset lookup');
        }
      }
      
      // If not an appointment code and we're in unified or asset mode, try asset lookup
      if (!isAppointmentCode && (mode === 'unified' || mode === 'asset')) {
        setDetectionType('asset');
        
        toast({
          title: 'Asset Barcode Detected',
          description: `Barcode: ${code}`,
          variant: 'default',
        });
        
        // Call the original asset detection callback
        setTimeout(() => {
          onDetected(code);
        }, 1000);
        
        return;
      }
      
      // If we get here and no matches found
      if (!isAppointmentCode) {
        toast({
          title: 'Code Not Recognized',
          description: 'This barcode is not recognized as an appointment or asset code.',
          variant: 'destructive',
        });
        
        // Reset for another scan
        setTimeout(() => {
          setIsProcessing(false);
          setLastDetection(null);
          setDetectionType(null);
        }, 2000);
      }
      
    } catch (error) {
      console.error('[UnifiedScanner] Error processing detected code:', error);
      toast({
        title: 'Scan Error',
        description: 'An error occurred while processing the scanned code.',
        variant: 'destructive',
      });
      
      setIsProcessing(false);
      setLastDetection(null);
      setDetectionType(null);
    }
  };

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    
    try {
      const track = streamRef.current.getVideoTracks()[0];
      const capabilities = track.getCapabilities() as any; // Torch might not be in TypeScript types yet
      
      // Check if torch is supported
      if (capabilities.torch) {
        const newTorchState = !torch;
        await track.applyConstraints({ advanced: [{ torch: newTorchState } as any] });
        setTorch(newTorchState);
      }
    } catch (error) {
      console.error('Error toggling torch:', error);
    }
  };

  const startScanner = async (deviceId: string) => {
    if (!videoRef.current) return;
    
    setLoading(true);
    
    // Save camera settings
    if (localStorage) {
      localStorage.setItem('lastUsedCameraId', deviceId);
    }
    
    // Dynamic import to avoid module resolution issues
    const { default: Quagga } = await import('quagga');
    
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
      (err: any) => {
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

    Quagga.onDetected((result: any) => {
      if (result && result.codeResult && result.codeResult.code) {
        const code = result.codeResult.code;
        console.log('Barcode detected:', code);
        
        // Confirm detection is valid
        if (code.length > 4) {
          // Stop scanning after detection
          stopScanner();
          
          // Process the detected barcode with enhanced logic
          handleDetection(code);
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
    setIsProcessing(false);
    setLastDetection(null);
    setDetectionType(null);
    if (activeCamera) {
      startScanner(activeCamera);
    } else if (cameras.length > 0) {
      startScanner(cameras[0].deviceId);
    }
  };

  // Get mode-specific title and instructions
  const getModeInfo = () => {
    switch (mode) {
      case 'asset':
        return {
          title: 'Scan Asset Barcode',
          instruction: 'Point your camera at an asset barcode',
          icon: <Package className="h-5 w-5" />
        };
      case 'appointment':
        return {
          title: 'Scan Appointment QR Code',
          instruction: 'Point your camera at an appointment QR code',
          icon: <Calendar className="h-5 w-5" />
        };
      default:
        return {
          title: 'Scan Code',
          instruction: 'Point your camera at any barcode or QR code',
          icon: <Camera className="h-5 w-5" />
        };
    }
  };

  const modeInfo = getModeInfo();

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          {modeInfo.icon}
          <h3 className="text-lg font-medium">{modeInfo.title}</h3>
          {mode === 'unified' && (
            <Badge variant="secondary" className="text-xs">
              Assets + Appointments
            </Badge>
          )}
        </div>
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
            className={`bg-black rounded-lg w-full ${isMobile ? 'h-[70vh] max-h-[70vh]' : 'h-[400px]'} overflow-hidden relative ${loading ? 'flex items-center justify-center' : ''}`}
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
                
                {/* Detection status overlay */}
                {lastDetection && (
                  <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center space-y-2">
                    <div className="flex items-center gap-2">
                      {detectionType === 'appointment' && <Calendar className="h-4 w-4 text-white" />}
                      {detectionType === 'asset' && <Package className="h-4 w-4 text-white" />}
                      {isProcessing && <CheckCircle className="h-4 w-4 text-green-400" />}
                    </div>
                    <Badge variant="secondary" className="bg-black/70 text-white px-3 py-1">
                      {isProcessing ? 'Processing...' : lastDetection}
                    </Badge>
                    {detectionType && (
                      <Badge variant="outline" className="bg-black/70 text-white border-white/30 text-xs">
                        {detectionType === 'appointment' ? 'Appointment Code' : 'Asset Barcode'}
                      </Badge>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          
          {/* Camera controls - Mobile optimized */}
          <div className="flex items-center justify-between gap-2">
            {/* Camera switcher - Responsive design */}
            {cameras.length > 1 && (
              isMobile ? (
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={switchCamera}
                  disabled={!scannerActive || loading || isProcessing}
                  className="flex-shrink-0"
                  title="Switch Camera"
                >
                  <SwitchCamera className="h-5 w-5" />
                </Button>
              ) : (
                <select
                  id="camera-select"
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm flex-1 max-w-[200px]"
                  value={activeCamera || ''}
                  onChange={(e) => handleCameraChange(e.target.value)}
                  disabled={!scannerActive || loading || isProcessing}
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
            
            {/* Instructions - Mobile responsive */}
            <p className={`text-center text-sm text-muted-foreground flex-1 ${isMobile ? 'text-xs' : ''}`}>
              {modeInfo.instruction}
            </p>
            
            {/* Flash toggle - Only on mobile */}
            {isMobile && (
              <Button
                variant={torch ? "secondary" : "outline"}
                size="icon"
                onClick={toggleTorch}
                disabled={!scannerActive || loading || isProcessing}
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