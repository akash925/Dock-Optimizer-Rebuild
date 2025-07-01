import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { Camera, Loader2, RotateCcw, Scan, XCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BrowserMultiFormatReader } from '@zxing/browser';

export type AppointmentScannerProps = {
  onScanComplete?: (scheduleId: number) => void;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  buttonText?: string;
};

export function AppointmentScanner({
  onScanComplete,
  variant = 'default',
  size = 'default',
  buttonText = 'Scan Code'
}: AppointmentScannerProps) {
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [searching, setSearching] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [loading, setLoading] = useState(true);
  
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  const videoRef = useRef<HTMLDivElement>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  
  const loadCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setCameras(videoDevices);
      
      if (videoDevices.length > 0) {
        setSelectedCamera(videoDevices[0].deviceId);
      }
    } catch (error) {
      console.error('Error loading cameras:', error);
    }
  };
  
  const startScanner = async () => {
    if (!selectedCamera) return;
    
    try {
      setLoading(true);
      setPermissionDenied(false);
      
      // Clean up previous scanner
      if (readerRef.current) {
        readerRef.current = null;
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      if (videoRef.current) {
        const video = document.createElement('video');
        video.setAttribute('playsinline', 'true');
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'cover';
        
        videoRef.current.innerHTML = '';
        videoRef.current.appendChild(video);
        videoElementRef.current = video;
        
        // Initialize @zxing/browser reader
        const reader = new BrowserMultiFormatReader();
        readerRef.current = reader;
        
        setLoading(false);
        
        // Start decoding from video device
        const result = await reader.decodeFromVideoDevice(selectedCamera, video, (result, error) => {
          if (result) {
            console.log('Detected QR/barcode:', result.getText());
            handleBarcodeDetected(result.getText());
          }
          if (error) {
            // Only log non-trivial errors
            if (!(error.name === 'NotFoundException')) {
              console.debug('Scanner error:', error);
            }
          }
        });
      }
    } catch (error) {
      console.error('Error starting camera:', error);
      setPermissionDenied(true);
      setLoading(false);
    }
  };
  
  const handleBarcodeDetected = async (code: string) => {
    setScanning(false);
    setSearching(true);
    
    try {
      // Check if this is a confirmation code or URL
      let confirmationCode = code;
      
      // If it's a URL, extract the code parameter
      if (code.includes('?code=')) {
        const url = new URL(code);
        confirmationCode = url.searchParams.get('code') || code;
      }
      
      // Search for an appointment with this code
      const response = await apiRequest('GET', `/api/schedules/confirmation/${confirmationCode}`);
      
      if (response.ok) {
        const schedule = await response.json();
        
        if (schedule && schedule.id) {
          toast({
            title: 'Appointment Found',
            description: `Found appointment for ${schedule.customerName || 'Unknown customer'}`,
          });
          
          // Call the callback if provided
          if (onScanComplete) {
            onScanComplete(schedule.id);
          }
          
          // Navigate to the appointment details
          setOpen(false);
          navigate(`/schedules/${schedule.id}`);
        } else {
          toast({
            title: 'No Appointment Found',
            description: `No appointment found with code: ${confirmationCode}`,
            variant: 'destructive',
          });
          setSearching(false);
          setScanning(true);
        }
      } else {
        toast({
          title: 'Search Failed',
          description: 'Failed to search for appointment by code',
          variant: 'destructive',
        });
        setSearching(false);
        setScanning(true);
      }
    } catch (error) {
      console.error('Error searching for appointment by code:', error);
      toast({
        title: 'Search Error',
        description: 'An error occurred while searching for the appointment',
        variant: 'destructive',
      });
      setSearching(false);
      setScanning(true);
    }
  };
  
  const handleOpenScanner = () => {
    setOpen(true);
    setScanning(true);
    loadCameras();
  };
  
  const handleClose = () => {
    setOpen(false);
    setScanning(false);
    setSearching(false);
    
    // Clean up @zxing reader
    if (readerRef.current) {
      readerRef.current = null;
    }
    
    // Clean up video stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Navigate to schedules to prevent blank screen
    navigate('/schedules', { replace: true });
  };
  
  const handleRetry = () => {
    setPermissionDenied(false);
    startScanner();
  };
  
  const handleCameraChange = (deviceId: string) => {
    setSelectedCamera(deviceId);
  };
  
  // Start scanner when camera is selected
  useEffect(() => {
    if (open && scanning && selectedCamera) {
      startScanner();
    }
    
    return () => {
      // Clean up @zxing reader when component unmounts
      if (readerRef.current) {
        readerRef.current = null;
      }
      
      // Clean up video stream when component unmounts
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [open, scanning, selectedCamera]);
  
  return (
    <>
      <Button 
        variant={variant}
        size={size}
        onClick={handleOpenScanner}
        aria-label="Scan QR Code"
        title="Scan Appointment QR Code"
      >
        <Scan className="h-5 w-5 mr-2" />
        {buttonText}
      </Button>
      
      <Dialog open={open} onOpenChange={(isOpen) => {
        if (!isOpen) handleClose();
        setOpen(isOpen);
      }}>
        <DialogContent className="sm:max-w-md w-[95vw] max-w-[95vw] sm:w-auto">
          <DialogHeader>
            <DialogTitle>Scan Appointment QR Code</DialogTitle>
            <DialogDescription>
              Scan a QR code to quickly look up appointment details
            </DialogDescription>
          </DialogHeader>
          
          {scanning && (
            <div className="flex flex-col space-y-4">
              {!permissionDenied && (
                <>
                  <div 
                    ref={videoRef} 
                    className="bg-black rounded-lg w-full h-[50vh] sm:h-[400px] overflow-hidden relative flex items-center justify-center"
                  >
                    {loading ? (
                      <div className="text-white text-center">
                        <Camera className="h-8 w-8 mx-auto mb-2 animate-pulse" />
                        <p>Starting camera...</p>
                      </div>
                    ) : null}
                  </div>
                  
                  {cameras.length > 1 && (
                    <div className="mt-2">
                      <p className="text-sm text-gray-500 mb-1">Select Camera:</p>
                      <Select value={selectedCamera} onValueChange={handleCameraChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a camera" />
                        </SelectTrigger>
                        <SelectContent>
                          {cameras.map((camera) => (
                            <SelectItem key={camera.deviceId} value={camera.deviceId}>
                              {camera.label || `Camera ${cameras.indexOf(camera) + 1}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  <div className="text-center text-sm text-gray-500 bg-gray-50 p-3 rounded-md">
                    Position the QR code in the center of the camera view
                  </div>
                </>
              )}
              
              {permissionDenied && (
                <div className="flex flex-col items-center justify-center p-6 space-y-4 text-center">
                  <div className="bg-red-50 text-red-600 p-4 rounded-lg">
                    <p className="font-semibold">Camera access denied</p>
                    <p className="text-sm mt-1">Please allow camera access to scan appointment codes</p>
                  </div>
                  <Button onClick={handleRetry} className="flex items-center gap-2">
                    <RotateCcw className="h-4 w-4" />
                    Try Again
                  </Button>
                </div>
              )}
            </div>
          )}
          
          {searching && (
            <div className="flex flex-col items-center justify-center p-6 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-center">Searching for appointment...</p>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}