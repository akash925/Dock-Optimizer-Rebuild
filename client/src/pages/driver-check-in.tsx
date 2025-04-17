import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, XCircle, Truck, Clock, FileText, QrCode, Search } from "lucide-react";
import { format } from "date-fns";

export default function DriverCheckIn() {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const [confirmationCode, setConfirmationCode] = useState("");
  const [searchClicked, setSearchClicked] = useState(false);
  
  // Parse confirmation code from the URL if present
  const params = new URLSearchParams(window.location.search);
  const codeFromUrl = params.get("code");
  
  // If code from URL, automatically fill and search
  useState(() => {
    if (codeFromUrl) {
      setConfirmationCode(codeFromUrl);
      setSearchClicked(true);
    }
  });
  
  // Query to get appointment details by confirmation code
  const { 
    data: appointment, 
    isLoading, 
    isError, 
    error, 
    refetch 
  } = useQuery({
    queryKey: ["/api/schedules/by-confirmation", confirmationCode],
    queryFn: async () => {
      if (!confirmationCode || !searchClicked) return null;
      const res = await apiRequest("GET", `/api/schedules/confirmation/${confirmationCode}`);
      if (!res.ok) {
        throw new Error("Appointment not found or has expired");
      }
      return res.json();
    },
    enabled: Boolean(confirmationCode && searchClicked),
    retry: false,
    refetchOnWindowFocus: false,
  });
  
  // Mutation for checking in appointment
  const checkInMutation = useMutation({
    mutationFn: async () => {
      if (!appointment?.id) throw new Error("No appointment ID found");
      const res = await apiRequest("PATCH", `/api/schedules/${appointment.id}/check-in`);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Check-in successful",
        description: "You have been checked in. Please proceed to the indicated dock.",
      });
      // Reset the search after successful check-in and refetch
      setSearchClicked(false);
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Check-in failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const handleSearch = () => {
    if (!confirmationCode) {
      toast({
        title: "Confirmation code required",
        description: "Please enter your confirmation code to proceed with check-in",
        variant: "destructive",
      });
      return;
    }
    
    setSearchClicked(true);
  };
  
  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "MM/dd/yyyy hh:mm a");
    } catch (e) {
      return "Invalid date";
    }
  };
  
  const isAppointmentValid = appointment && appointment.status === "scheduled";
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="w-full max-w-3xl space-y-6">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold">Hanzo Logistics</h1>
          <p className="text-muted-foreground">Driver Check-In Portal</p>
        </header>
        
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              Driver Check-In
            </CardTitle>
            <CardDescription>
              Enter your confirmation code or scan your QR code to check in for your appointment
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <div className="grid gap-6">
              <div className="flex items-end gap-4">
                <div className="grid gap-2 flex-1">
                  <Label htmlFor="confirmation-code">Confirmation Code</Label>
                  <Input
                    id="confirmation-code"
                    placeholder="Enter your confirmation code (e.g., HC000123)"
                    value={confirmationCode}
                    onChange={(e) => setConfirmationCode(e.target.value)}
                    disabled={isLoading || checkInMutation.isPending}
                  />
                </div>
                
                <Button 
                  onClick={handleSearch}
                  disabled={isLoading || !confirmationCode || checkInMutation.isPending}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                  Find Appointment
                </Button>
              </div>
              
              {isLoading && (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
              
              {isError && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>
                    {error instanceof Error ? error.message : "Appointment not found or invalid confirmation code"}
                  </AlertDescription>
                </Alert>
              )}
              
              {appointment && (
                <div className="border rounded-md p-4 mt-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className={`rounded-full h-3 w-3 ${appointment.status === "scheduled" ? "bg-green-500" : appointment.status === "in-progress" ? "bg-blue-500" : "bg-red-500"}`}></div>
                    <span className="font-medium">
                      Status: {appointment.status === "scheduled" ? "Ready for Check-In" : 
                              appointment.status === "in-progress" ? "In Progress (Already Checked In)" : 
                              "Not Available (Completed or Cancelled)"}
                    </span>
                  </div>
                  
                  <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Appointment Time:</Label>
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span>{formatDate(appointment.startTime)}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Dock Assignment:</Label>
                      <div className="flex items-center">
                        <Truck className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span>{appointment.dockName || "Not assigned yet"}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Customer:</Label>
                      <div className="flex items-center">
                        <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span>{appointment.customerName || "Not specified"}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Carrier:</Label>
                      <div className="flex items-center">
                        <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span>{appointment.carrierName || "Not specified"}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Truck Number:</Label>
                      <div className="flex items-center">
                        <Truck className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span>{appointment.truckNumber || "Not specified"}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Type:</Label>
                      <div className="flex items-center">
                        <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span>{appointment.type === "inbound" ? "Inbound (Drop-off)" : "Outbound (Pick-up)"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
          
          <CardFooter className="flex justify-between">
            <Button 
              variant="outline" 
              onClick={() => setLocation("/")}
            >
              Return to Homepage
            </Button>
            
            {appointment && isAppointmentValid && (
              <Button 
                onClick={() => checkInMutation.mutate()}
                disabled={checkInMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {checkInMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Check In Now
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}