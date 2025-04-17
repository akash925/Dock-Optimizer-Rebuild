import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarCheck, CheckCircle, Printer, Home, Mail, Share2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { format } from "date-fns";
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

export default function BookingConfirmation() {
  const [, navigate] = useLocation();
  const [bookingDetails, setBookingDetails] = useState<any>(null);
  
  // In a real app, you would fetch the booking details from the query parameters or API
  // For demo purposes, we're using dummy data
  useEffect(() => {
    // This would typically come from query parameters or local storage
    const urlParams = new URLSearchParams(window.location.search);
    const bookingId = urlParams.get("bookingId");
    
    if (bookingId) {
      // In a real application, you would fetch the booking details from the API
      // For now, we'll use mock data
      setBookingDetails({
        id: bookingId,
        confirmationNumber: "HZL-" + Math.floor(100000 + Math.random() * 900000),
        appointmentDate: new Date().toLocaleDateString(),
        appointmentTime: "10:00 AM",
        location: "450 Airtech Pkwy Plainfield IN 46168",
        companyName: "Sample Company",
        contactName: "John Doe",
      });
    } else {
      // If there's no booking ID, redirect to the booking page
      // uncomment this in production
      // navigate("/external-booking");
      
      // For demo, use mock data
      setBookingDetails({
        id: "demo-123456",
        confirmationNumber: "HZL-" + Math.floor(100000 + Math.random() * 900000),
        appointmentDate: new Date().toLocaleDateString(),
        appointmentTime: "10:00 AM",
        location: "450 Airtech Pkwy Plainfield IN 46168",
        companyName: "Sample Company",
        contactName: "John Doe",
      });
    }
  }, [navigate]);

  const handlePrint = () => {
    window.print();
  };

  const handleNewBooking = () => {
    navigate("/external-booking");
  };

  const handleHome = () => {
    navigate("/");
  };
  
  // Generate a check-in URL with the confirmation code
  const getCheckInUrl = () => {
    const code = bookingDetails.confirmationNumber.replace('HZL-', '');
    return `${window.location.origin}/driver-check-in?code=${code}`;
  };
  
  // Email the appointment details
  const handleEmailShare = () => {
    const subject = `Dock Appointment Confirmation: ${bookingDetails.confirmationNumber}`;
    const body = `
Hello,

Here are your appointment details for Hanzo Logistics:

Confirmation Number: ${bookingDetails.confirmationNumber}
Date: ${bookingDetails.appointmentDate}
Time: ${bookingDetails.appointmentTime}
Location: ${bookingDetails.location}

Please bring this confirmation to your appointment.
You can check in by visiting: ${getCheckInUrl()}

Thank you,
Hanzo Logistics
    `;
    
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  if (!bookingDetails) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-green-100 py-6 md:py-12 px-2 md:px-4">
      <div className="max-w-3xl mx-auto w-full">
        <div className="flex flex-col items-center mb-6 md:mb-8">
          <img 
            src="https://www.hanzologistics.com/wp-content/uploads/2021/11/Hanzo_Logo_no_tag-1.png" 
            alt="Hanzo Logistics" 
            className="h-12 mb-3" 
          />
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-green-100 flex items-center justify-center mb-3 md:mb-4">
            <CheckCircle className="h-10 w-10 md:h-12 md:w-12 text-green-600" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 text-center">Appointment Confirmed!</h1>
          <p className="text-center text-gray-600 mt-2 px-2">
            Your dock appointment has been successfully scheduled with Hanzo Logistics.
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
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-500">Appointment Date</span>
                  <span>{bookingDetails.appointmentDate}</span>
                </div>
                
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-500">Appointment Time</span>
                  <span>{bookingDetails.appointmentTime}</span>
                </div>
              </div>
              
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-500">Location</span>
                <span>{bookingDetails.location}</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-500">Company</span>
                  <span>{bookingDetails.companyName}</span>
                </div>
                
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-500">Contact</span>
                  <span>{bookingDetails.contactName}</span>
                </div>
              </div>
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

Here are your appointment details for Hanzo Logistics:

Confirmation Number: ${bookingDetails.confirmationNumber}
Date: ${bookingDetails.appointmentDate}
Time: ${bookingDetails.appointmentTime}
Location: ${bookingDetails.location}

Please bring this confirmation to your appointment.
You can check in by visiting: ${getCheckInUrl()}

Thank you,
Hanzo Logistics`}
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
                New Booking
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