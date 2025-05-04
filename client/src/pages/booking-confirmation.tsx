import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarCheck, CheckCircle, Printer, Home, Mail, Share2, Loader2, Settings } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { format } from "date-fns";
import { 
  formatInFacilityTimeZone, 
  formatForDualTimeZoneDisplay, 
  getTimeZoneAbbreviation 
} from "@/lib/timezone-utils";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface BookingDetails {
  id: number;
  confirmationNumber: string;
  appointmentDate: string;
  appointmentTime: string;
  facilityTimeDisplay: string;
  userTimeDisplay: string;
  location: string;
  customerName: string;
  carrierName: string;
  contactName: string;
  truckNumber: string;
  trailerNumber: string | null;
  type: string;
  notes: string | null;
  tenantId?: number | null;
  organizationName?: string;
}

export default function BookingConfirmation() {
  const [, navigate] = useLocation();
  const [bookingDetails, setBookingDetails] = useState<BookingDetails | null>(null);
  const [schedule, setSchedule] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showUserTimeFirst, setShowUserTimeFirst] = useState(false);
  const [showTimePreferences, setShowTimePreferences] = useState(false);
  const { toast } = useToast();
  
  // Fetch the schedule and related data based on URL parameters
  useEffect(() => {
    const fetchBookingDetails = async () => {
      try {
        setLoading(true);
        const urlParams = new URLSearchParams(window.location.search);
        const bookingId = urlParams.get("bookingId");
        const confirmationNumber = urlParams.get("confirmationNumber");
        
        if (!bookingId || isNaN(Number(bookingId))) {
          toast({
            title: "Missing booking information",
            description: "No valid booking ID was provided. Redirecting you to the booking page.",
            variant: "destructive",
          });
          setTimeout(() => navigate("/external-booking"), 3000);
          return;
        }
        
        // Fetch the schedule data
        const response = await fetch(`/api/schedules/${bookingId}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch schedule data: ${response.statusText}`);
        }
        
        const scheduleData = await response.json();
        setSchedule(scheduleData);
        
        // Try to get organization information if we have facility or tenant ID
        let organizationName = null;
        if (scheduleData.tenantId) {
          try {
            const orgResponse = await fetch(`/api/organizations/${scheduleData.tenantId}`);
            if (orgResponse.ok) {
              const orgData = await orgResponse.json();
              organizationName = orgData.name;
              setSchedule(prev => ({...prev, organizationName}));
            }
          } catch (err) {
            console.error("Error fetching organization info:", err);
          }
        }
        
        // Get dock information to get the facility/location
        const dockResponse = await fetch(`/api/docks/${schedule.dockId}`);
        let facilityId = null;
        
        if (dockResponse.ok) {
          const dock = await dockResponse.json();
          facilityId = dock.facilityId;
        }
        
        // Get facility information for location
        let locationName = "Unknown Location";
        if (facilityId) {
          const facilityResponse = await fetch(`/api/facilities/${facilityId}`);
          if (facilityResponse.ok) {
            const facility = await facilityResponse.json();
            locationName = facility.name;
            if (facility.address1) {
              locationName += `, ${facility.address1}`;
            }
            if (facility.city && facility.state) {
              locationName += `, ${facility.city}, ${facility.state}`;
            }
          }
        }
        
        // Get carrier information
        let carrierName = "Unknown Carrier";
        if (schedule.carrierId) {
          const carrierResponse = await fetch(`/api/carriers/${schedule.carrierId}`);
          if (carrierResponse.ok) {
            const carrier = await carrierResponse.json();
            carrierName = carrier.name;
          }
        }
        
        // Format dates using our timezone utilities
        const startDate = new Date(schedule.startTime);
        const facilityTimeZone = 'America/New_York'; // Eastern Time
        
        // Get the date in facility timezone (Eastern Time)
        const appointmentDate = formatInFacilityTimeZone(startDate, 'MM/dd/yyyy', facilityTimeZone);
        
        // Get time display in both facility and user timezones
        const { 
          facilityTime, 
          userTime, 
          facilityZone, 
          userZone 
        } = formatForDualTimeZoneDisplay(startDate, facilityTimeZone, 'h:mm a');
        
        // Get timezone abbreviations
        const facilityZoneAbbr = getTimeZoneAbbreviation(facilityZone, startDate);
        const userZoneAbbr = getTimeZoneAbbreviation(userZone, startDate);
        
        // Format time displays for facility and user
        const facilityTimeDisplay = `${facilityTime} ${facilityZoneAbbr}`;
        const userTimeDisplay = `${userTime} ${userZoneAbbr}`;
        
        // For backward compatibility
        const appointmentTime = facilityTimeDisplay;
        
        // Set booking details
        setBookingDetails({
          id: Number(bookingId),
          confirmationNumber: confirmationNumber || "HZL-" + Math.floor(100000 + Math.random() * 900000),
          appointmentDate,
          appointmentTime,
          facilityTimeDisplay,
          userTimeDisplay,
          location: locationName,
          customerName: schedule.customerName || "Not provided",
          carrierName,
          contactName: schedule.driverName || "Not provided",
          truckNumber: schedule.truckNumber,
          trailerNumber: schedule.trailerNumber,
          type: schedule.type,
          notes: schedule.notes,
          tenantId: schedule.tenantId,
          organizationName: organizationName,
        });
        
      } catch (error) {
        console.error("Error fetching booking details:", error);
        toast({
          title: "Error loading booking details",
          description: error instanceof Error ? error.message : "An unknown error occurred",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchBookingDetails();
  }, [navigate, toast]);

  const handlePrint = () => {
    window.print();
  };

  const handleNewBooking = () => {
    // Add a reset parameter to ensure the form is completely reset
    navigate("/external-booking?reset=true");
  };

  const handleHome = () => {
    navigate("/");
  };
  
  // Generate a check-in URL with the confirmation code
  const getCheckInUrl = () => {
    if (!bookingDetails) return '';
    const code = bookingDetails.confirmationNumber.replace('HZL-', '');
    return `${window.location.origin}/driver-check-in?code=${code}`;
  };
  
  // Email the appointment details
  const handleEmailShare = () => {
    if (!bookingDetails) return;
    
    const subject = `Dock Appointment Confirmation: ${bookingDetails.confirmationNumber}`;
    const appointmentType = bookingDetails.type ? bookingDetails.type.toLowerCase() : "appointment";
    const orgName = schedule?.organizationName || 'our logistics facility';
    
    // Format time display based on user preference
    const timeDisplay = showUserTimeFirst 
      ? `${bookingDetails.userTimeDisplay} (Your local time)\n      ${bookingDetails.facilityTimeDisplay} (Facility time)`
      : `${bookingDetails.facilityTimeDisplay} (Facility time)\n      ${bookingDetails.userTimeDisplay} (Your local time)`;
    
    const body = `
Hello,

Here are your ${appointmentType} appointment details for ${orgName}:

Confirmation Number: ${bookingDetails.confirmationNumber}
Date: ${bookingDetails.appointmentDate}
Time: ${timeDisplay}
Location: ${bookingDetails.location}
Carrier: ${bookingDetails.carrierName}
${bookingDetails.truckNumber ? `Truck #: ${bookingDetails.truckNumber}` : ''}
${bookingDetails.trailerNumber ? `Trailer #: ${bookingDetails.trailerNumber}` : ''}
Driver: ${bookingDetails.contactName}

IMPORTANT:
- Please arrive 15 minutes before your scheduled time
- Have your confirmation number or QR code ready
- Check in with dock staff upon arrival
- For questions, call the facility directly

You can check in by scanning the QR code in the attachment or visiting: ${getCheckInUrl()}

Thank you,
${orgName}
    `;
    
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  if (loading || !bookingDetails) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gradient-to-b from-green-50 to-green-100">
        {/* Use a generic logo while loading since we don't know the tenant yet */}
        <img 
          src="/logo.png" 
          alt="Dock Optimizer" 
          className="h-12 mb-6" 
        />
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg font-medium text-gray-700">Loading your appointment details...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-green-100 py-6 md:py-12 px-2 md:px-4">
      <div className="max-w-3xl mx-auto w-full">
        <div className="relative w-full flex justify-end mb-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5 text-gray-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="px-4 py-3 border-b">
                <p className="text-sm font-medium">Display preferences</p>
              </div>
              <div className="p-4 flex items-center gap-4">
                <div className="flex-1">
                  <Label htmlFor="time-display-preference" className="text-sm text-gray-600">
                    Show my local time first
                  </Label>
                </div>
                <Switch 
                  id="time-display-preference"
                  checked={showUserTimeFirst}
                  onCheckedChange={setShowUserTimeFirst}
                />
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex flex-col items-center mb-6 md:mb-8">
          {/* Use the tenant-aware logo endpoint */}
          <img 
            src={`/api/booking-pages/logo/${schedule?.tenantId || ''}`}
            alt={`${schedule?.organizationName || 'Logistics'} Logo`}
            className="h-12 mb-3" 
            onError={(e) => {
              // Fallback to static logo if the API fails
              const imgElement = e.target as HTMLImageElement;
              imgElement.src = "/logo.png"; 
              console.log("Using fallback logo due to error loading from API");
            }}
          />
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-green-100 flex items-center justify-center mb-3 md:mb-4">
            <CheckCircle className="h-10 w-10 md:h-12 md:w-12 text-green-600" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 text-center">Appointment Confirmed!</h1>
          <p className="text-center text-gray-600 mt-2 px-2">
            Your dock appointment has been successfully scheduled with {schedule?.organizationName || 'Dock Optimizer'}.
          </p>
        </div>

        <Card className="w-full shadow-lg">
          <CardHeader className="bg-primary/5">
            <CardTitle className="flex items-center">
              <CalendarCheck className="mr-2 h-5 w-5" />
              Appointment Details
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid gap-4">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-500">Confirmation Number</span>
                <span className="text-lg font-bold">{bookingDetails.confirmationNumber}</span>
              </div>
              
              {/* Enhanced Date/Time Display */}
              <div className="mb-4 bg-green-50 p-4 rounded-lg border border-green-100">
                <h3 className="font-bold text-lg text-green-800 mb-2 flex items-center">
                  <CalendarCheck className="mr-2 h-5 w-5" />
                  Appointment Date & Time
                </h3>
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-green-700">Date</span>
                    <span className="text-xl font-bold">{bookingDetails.appointmentDate}</span>
                  </div>
                  
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-green-700">Time</span>
                    <div className="flex flex-col gap-2">
                      {showUserTimeFirst ? (
                        <>
                          <div className="bg-white p-2 rounded border border-green-200">
                            <span className="text-xs text-green-600 uppercase font-bold block">Your Local Time</span>
                            <span className="text-xl font-bold">{bookingDetails.userTimeDisplay}</span>
                          </div>
                          <div className="bg-white/50 p-2 rounded border border-green-100">
                            <span className="text-xs text-green-600 uppercase font-bold block">Facility Time</span>
                            <span className="text-lg font-medium">{bookingDetails.facilityTimeDisplay}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="bg-white p-2 rounded border border-green-200">
                            <span className="text-xs text-green-600 uppercase font-bold block">Facility Time</span>
                            <span className="text-xl font-bold">{bookingDetails.facilityTimeDisplay}</span>
                          </div>
                          <div className="bg-white/50 p-2 rounded border border-green-100">
                            <span className="text-xs text-green-600 uppercase font-bold block">Your Local Time</span>
                            <span className="text-lg font-medium">{bookingDetails.userTimeDisplay}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-500">Location</span>
                <span>{bookingDetails.location}</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-500">Customer</span>
                  <span>{bookingDetails.customerName}</span>
                </div>
                
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-500">Carrier</span>
                  <span>{bookingDetails.carrierName}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-500">Driver</span>
                  <span>{bookingDetails.contactName}</span>
                </div>
                
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-500">Truck #</span>
                  <span>{bookingDetails.truckNumber || "Not provided"}</span>
                </div>
              </div>

              {bookingDetails.trailerNumber && (
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-500">Trailer #</span>
                  <span>{bookingDetails.trailerNumber}</span>
                </div>
              )}

              {bookingDetails.type && (
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-500">Appointment Type</span>
                  <div className="flex items-center">
                    <span className={`inline-block w-3 h-3 rounded-full mr-2 ${bookingDetails.type.toLowerCase() === 'inbound' ? 'bg-blue-500' : 'bg-green-500'}`}></span>
                    <span className="capitalize">{bookingDetails.type.toLowerCase()}</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            {/* QR Code Display */}
            <div className="bg-blue-50 p-4 rounded-md border border-blue-100 w-full">
              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="bg-white p-3 rounded-md shadow-sm">
                  <QRCodeSVG 
                    value={getCheckInUrl()}
                    size={120}
                    bgColor="#FFFFFF"
                    fgColor="#000000"
                    level="H"
                    includeMargin={false}
                  />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-blue-800 mb-1">Check-In QR Code</h3>
                  <p className="text-sm text-blue-700 mb-3">
                    Show this QR code to dock staff when you arrive at the warehouse.
                  </p>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="bg-blue-100 border-blue-200 hover:bg-blue-200">
                        <Share2 className="mr-2 h-4 w-4" />
                        Share via Email
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Share Appointment Details</DialogTitle>
                        <DialogDescription>
                          Send the appointment details and check-in QR code to the driver.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="flex flex-col space-y-4 py-4">
                        <div className="border rounded-md p-4 bg-slate-50">
                          <p className="text-sm mb-2">
                            <strong>Subject:</strong> Dock Appointment Confirmation: {bookingDetails.confirmationNumber}
                          </p>
                          <p className="text-sm whitespace-pre-wrap border-t pt-2 mt-2">
                            {`Hello,

Here are your ${bookingDetails.type ? bookingDetails.type.toLowerCase() : "appointment"} appointment details for ${schedule?.organizationName || 'our logistics facility'}:

Confirmation Number: ${bookingDetails.confirmationNumber}
Date: ${bookingDetails.appointmentDate}
Time: ${showUserTimeFirst 
  ? `${bookingDetails.userTimeDisplay} (Your local time)\n      ${bookingDetails.facilityTimeDisplay} (Facility time)`
  : `${bookingDetails.facilityTimeDisplay} (Facility time)\n      ${bookingDetails.userTimeDisplay} (Your local time)`
}
Location: ${bookingDetails.location}
Carrier: ${bookingDetails.carrierName}
${bookingDetails.truckNumber ? `Truck #: ${bookingDetails.truckNumber}` : ''}
${bookingDetails.trailerNumber ? `Trailer #: ${bookingDetails.trailerNumber}` : ''}
Driver: ${bookingDetails.contactName}

IMPORTANT:
- Please arrive 15 minutes before your scheduled time
- Have your confirmation number or QR code ready
- Check in with dock staff upon arrival
- For questions, call the facility directly

You can check in by scanning the QR code in the attachment or visiting: ${getCheckInUrl()}

Thank you,
${schedule?.organizationName || 'Dock Optimizer'}`}
                          </p>
                        </div>
                      </div>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button onClick={handleEmailShare}>
                          <Mail className="mr-2 h-4 w-4" />
                          Send Email
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>

            {/* Important notice */}
            <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200 w-full">
              <p className="text-sm text-yellow-800">
                <strong>Important:</strong> Please arrive 15 minutes before your scheduled time and have your confirmation number ready.
              </p>
            </div>
            
            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row w-full gap-3">
              <Button 
                variant="outline" 
                className="flex-1 flex items-center justify-center" 
                onClick={handlePrint}
              >
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
              <Button 
                variant="outline" 
                className="flex-1 flex items-center justify-center" 
                onClick={handleNewBooking}
              >
                <CalendarCheck className="mr-2 h-4 w-4" />
                New Appointment
              </Button>
              <Button 
                className="flex-1 flex items-center justify-center" 
                onClick={handleHome}
              >
                <Home className="mr-2 h-4 w-4" />
                Return Home
              </Button>
            </div>
          </CardFooter>
        </Card>
        
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600">
            A confirmation email has been sent to your provided email address.
          </p>
          <p className="text-sm text-gray-600 mt-1">
            If you need to modify or cancel your appointment, please contact our customer service team.
          </p>
        </div>
      </div>
    </div>
  );
}