import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AppointmentDetails {
  id: number;
  confirmationNumber: string;
  truckNumber: string;
  trailerNumber?: string | null;
  carrierName?: string | null;
  driverName?: string | null;
  appointmentDate: string;
  appointmentTime: string;
  dockName?: string | null;
  facilityName?: string | null;
  status: string;
  type: string;
}

export default function DriverCheckIn() {
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(true);
  const [appointment, setAppointment] = useState<AppointmentDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchAppointmentByCode = async () => {
      try {
        setLoading(true);
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        
        if (!code) {
          setError('No confirmation code provided. Please scan a valid QR code.');
          setLoading(false);
          return;
        }
        
        // Look up the appointment by confirmation code
        // Handle various format possibilities: HC123, HZL-123, or just 123
        let formattedCode = code;
        if (!code.startsWith('HC')) {
          // Remove any prefix like HZL- if present
          const numericPart = code.replace(/^[A-Za-z]+-?/, '');
          formattedCode = `HC${numericPart}`;
        }
        console.log('Looking up appointment with code:', formattedCode);
        const response = await fetch(`/api/schedules/confirmation/${formattedCode}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('Appointment not found. Please verify your confirmation code.');
          } else {
            setError('Failed to retrieve appointment details. Please try again.');
          }
          setLoading(false);
          return;
        }
        
        const data = await response.json();
        
        // Format the appointment data
        const startDate = new Date(data.startTime);
        const formattedDate = startDate.toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
        const formattedTime = startDate.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        });
        
        // Get facility name if available
        let facilityName = null;
        if (data.facilityId) {
          try {
            const facilityResponse = await fetch(`/api/facilities/${data.facilityId}`);
            if (facilityResponse.ok) {
              const facility = await facilityResponse.json();
              facilityName = facility.name;
            }
          } catch (err) {
            console.error('Error fetching facility details:', err);
          }
        }
        
        // Get dock name if available
        let dockName = null;
        if (data.dockId) {
          try {
            const dockResponse = await fetch(`/api/docks/${data.dockId}`);
            if (dockResponse.ok) {
              const dock = await dockResponse.json();
              dockName = dock.name;
            }
          } catch (err) {
            console.error('Error fetching dock details:', err);
          }
        }
        
        setAppointment({
          id: data.id,
          confirmationNumber: `HC${data.id}`,
          truckNumber: data.truckNumber || 'Not provided',
          trailerNumber: data.trailerNumber,
          carrierName: data.carrierName,
          driverName: data.driverName,
          appointmentDate: formattedDate,
          appointmentTime: formattedTime,
          dockName: dockName,
          facilityName: facilityName,
          status: data.status,
          type: data.type
        });
        
        // Check if already checked in
        if (data.status === 'checked-in' || data.status === 'in-progress') {
          setCheckedIn(true);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error during appointment lookup:', err);
        setError('An unexpected error occurred. Please try again.');
        setLoading(false);
      }
    };

    fetchAppointmentByCode();
  }, []);

  const handleCheckIn = async () => {
    if (!appointment) return;
    
    try {
      setCheckingIn(true);
      
      // Update appointment status to checked-in
      const response = await fetch(`/api/schedules/${appointment.id}/check-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'checked-in',
          lastModifiedAt: new Date().toISOString()
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to check in appointment');
      }
      
      // Show success message
      toast({
        title: 'Check-in successful',
        description: 'You have been checked in for your appointment.',
        variant: 'default',
      });
      
      setCheckedIn(true);
      setCheckingIn(false);
    } catch (err) {
      console.error('Error during check-in:', err);
      
      toast({
        title: 'Check-in failed',
        description: 'Unable to check in. Please try again or contact facility staff.',
        variant: 'destructive',
      });
      
      setCheckingIn(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-b from-blue-50 to-white">
        <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
        <h2 className="text-xl font-semibold text-gray-800">Loading Appointment Details</h2>
        <p className="text-gray-600 mt-2">Please wait while we retrieve your appointment information...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-b from-red-50 to-white">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-gray-800">Appointment Not Found</h2>
        <p className="text-gray-600 mt-2 text-center max-w-md">{error}</p>
        <Button 
          variant="outline" 
          className="mt-6"
          onClick={() => navigate('/')}
        >
          Return to Home
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-md w-full">
        <Card className="w-full shadow-lg">
          <CardHeader className="bg-primary text-white">
            <CardTitle className="text-center">Dock Appointment Check-In</CardTitle>
          </CardHeader>
          
          <CardContent className="pt-6">
            {checkedIn ? (
              <div className="flex flex-col items-center text-center mb-6">
                <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
                <h2 className="text-2xl font-bold text-green-700">Check-In Complete</h2>
                <p className="text-gray-600 mt-2">
                  You've been successfully checked in. Please proceed to the assigned dock.
                </p>
              </div>
            ) : (
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-2">Ready for Check-In</h2>
                <p className="text-gray-600">
                  Please confirm your appointment details below before checking in.
                </p>
              </div>
            )}
            
            {appointment && (
              <div className="space-y-4 mt-4">
                <div className="flex justify-between border-b pb-2">
                  <span className="font-medium text-gray-600">Confirmation:</span>
                  <span className="font-semibold">{appointment.confirmationNumber}</span>
                </div>
                
                <div className="flex justify-between border-b pb-2">
                  <span className="font-medium text-gray-600">Date:</span>
                  <span>{appointment.appointmentDate}</span>
                </div>
                
                <div className="flex justify-between border-b pb-2">
                  <span className="font-medium text-gray-600">Time:</span>
                  <span>{appointment.appointmentTime}</span>
                </div>
                
                {appointment.facilityName && (
                  <div className="flex justify-between border-b pb-2">
                    <span className="font-medium text-gray-600">Facility:</span>
                    <span>{appointment.facilityName}</span>
                  </div>
                )}
                
                {appointment.dockName && (
                  <div className="flex justify-between border-b pb-2">
                    <span className="font-medium text-gray-600">Dock:</span>
                    <span>{appointment.dockName}</span>
                  </div>
                )}
                
                <div className="flex justify-between border-b pb-2">
                  <span className="font-medium text-gray-600">Type:</span>
                  <span className="capitalize">{appointment.type.toLowerCase()}</span>
                </div>
                
                <div className="flex justify-between border-b pb-2">
                  <span className="font-medium text-gray-600">Truck #:</span>
                  <span>{appointment.truckNumber}</span>
                </div>
                
                {appointment.trailerNumber && (
                  <div className="flex justify-between border-b pb-2">
                    <span className="font-medium text-gray-600">Trailer #:</span>
                    <span>{appointment.trailerNumber}</span>
                  </div>
                )}
                
                {appointment.driverName && (
                  <div className="flex justify-between border-b pb-2">
                    <span className="font-medium text-gray-600">Driver:</span>
                    <span>{appointment.driverName}</span>
                  </div>
                )}
                
                {appointment.carrierName && (
                  <div className="flex justify-between border-b pb-2">
                    <span className="font-medium text-gray-600">Carrier:</span>
                    <span>{appointment.carrierName}</span>
                  </div>
                )}
                
                <div className="flex justify-between border-b pb-2">
                  <span className="font-medium text-gray-600">Status:</span>
                  <span className={`capitalize ${
                    checkedIn ? 'text-green-600 font-bold' : 'text-blue-600'
                  }`}>
                    {checkedIn ? 'Checked In' : appointment.status}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
          
          <CardFooter className="flex justify-center pt-2 pb-6">
            {!checkedIn ? (
              <Button
                className="w-full"
                onClick={handleCheckIn}
                disabled={checkingIn}
              >
                {checkingIn ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Check In Now'
                )}
              </Button>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate('/')}
              >
                Return to Home
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}