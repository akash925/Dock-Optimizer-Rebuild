import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Clock, Info, Loader2, QrCode, Truck, ArrowRight } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Schedule } from "@shared/schema";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function DriverCheckIn() {
  const [confirmationCode, setConfirmationCode] = useState("");
  const [_location, navigate] = useLocation();
  const [foundSchedule, setFoundSchedule] = useState<Schedule | null>(null);
  const [activeTab, setActiveTab] = useState("manual");

  // Check for code parameter in URL (from QR code scanning)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('code');
    
    if (codeParam) {
      setConfirmationCode(codeParam);
      // Auto-lookup if code is found in URL
      lookupMutation.mutate(codeParam);
      
      // Clean up URL to avoid duplicate lookups on refresh
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const lookupMutation = useMutation({
    mutationFn: async (code: string) => {
      // Clean the code to handle HC prefix
      const cleanCode = code.trim().replace(/^HC/i, '');
      
      const response = await apiRequest("GET", `/api/schedules/confirmation/${cleanCode}`);
      if (!response.ok) {
        throw new Error(response.statusText);
      }
      return response.json() as Promise<Schedule>;
    },
    onSuccess: (data) => {
      setFoundSchedule(data);
      toast({
        title: "Appointment found",
        description: "Your appointment details have been loaded.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error finding appointment",
        description: error.message || "Could not find appointment with that confirmation code",
        variant: "destructive",
      });
    }
  });

  const checkInMutation = useMutation({
    mutationFn: async (scheduleId: number) => {
      const response = await apiRequest("PATCH", `/api/schedules/${scheduleId}/check-in`);
      if (!response.ok) {
        throw new Error(response.statusText);
      }
      return response.json() as Promise<Schedule>;
    },
    onSuccess: (data) => {
      toast({
        title: "Check-in successful",
        description: "You have been checked in for your appointment.",
        variant: "default",
      });
      
      // Update the displayed schedule with the new data instead of resetting
      setFoundSchedule(data);
    },
    onError: (error: Error) => {
      toast({
        title: "Check-in failed",
        description: error.message || "Failed to check in",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationCode) return;
    lookupMutation.mutate(confirmationCode);
  };

  const handleCheckIn = () => {
    if (foundSchedule) {
      checkInMutation.mutate(foundSchedule.id);
    }
  };

  // Get appointment time information
  const getAppointmentTimeStatus = (schedule: Schedule) => {
    const now = new Date();
    const startTime = new Date(schedule.startTime);
    const endTime = new Date(schedule.endTime);
    
    const minutesUntilStart = Math.floor((startTime.getTime() - now.getTime()) / (1000 * 60));
    const minutesUntilEnd = Math.floor((endTime.getTime() - now.getTime()) / (1000 * 60));
    
    if (minutesUntilStart > 30) {
      return {
        status: "early",
        message: `Your appointment starts in ${Math.floor(minutesUntilStart / 60)} hours and ${minutesUntilStart % 60} minutes`,
        icon: <Clock className="h-4 w-4 text-amber-500" />
      };
    } else if (minutesUntilStart > 0) {
      return {
        status: "approaching",
        message: `Your appointment starts in ${minutesUntilStart} minutes`,
        icon: <Clock className="h-4 w-4 text-green-500" />
      };
    } else if (minutesUntilEnd > 0) {
      return {
        status: "active",
        message: "Your appointment is active now",
        icon: <ArrowRight className="h-4 w-4 text-green-600" />
      };
    } else {
      return {
        status: "past",
        message: "Your appointment time has passed",
        icon: <AlertTriangle className="h-4 w-4 text-red-500" />
      };
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl flex items-center justify-center gap-2">
            <Truck className="h-6 w-6" />
            Driver Check-In Portal
          </CardTitle>
          <CardDescription>
            {!foundSchedule ? "Scan or enter the driver's confirmation code to check them in" : "Appointment found"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!foundSchedule ? (
            <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="manual">Manual Entry</TabsTrigger>
                <TabsTrigger value="qrcode">QR Code Info</TabsTrigger>
              </TabsList>
              
              <TabsContent value="manual" className="space-y-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <div className="relative">
                      <Input
                        type="text"
                        id="confirmation-code"
                        placeholder="Enter confirmation code (e.g. HC123)"
                        value={confirmationCode}
                        onChange={(e) => setConfirmationCode(e.target.value)}
                        className="pr-10 text-center text-lg tracking-wider"
                        autoComplete="off"
                        disabled={lookupMutation.isPending}
                      />
                      <QrCode className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={!confirmationCode || lookupMutation.isPending}
                  >
                    {lookupMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    {lookupMutation.isPending ? "Looking up..." : "Find Appointment"}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="qrcode" className="space-y-4">
                <div className="p-4 border border-dashed rounded-md bg-slate-50">
                  <div className="text-center space-y-4">
                    <QrCode className="h-16 w-16 mx-auto text-gray-400" />
                    <h3 className="font-medium">Scan the driver's QR code</h3>
                    <p className="text-sm text-muted-foreground">
                      Open your camera app and point it at the QR code provided by the driver. 
                      The code will automatically redirect you to this page with the appointment information.
                    </p>
                    
                    <Alert className="bg-blue-50 border-blue-200">
                      <Info className="h-4 w-4" />
                      <AlertTitle>Tips for QR Code Scanning</AlertTitle>
                      <AlertDescription className="text-xs text-left">
                        <ul className="list-disc pl-4 space-y-1 mt-1">
                          <li>Ensure good lighting for better scanning</li>
                          <li>Hold your camera steady</li>
                          <li>Position the QR code within the camera frame</li>
                          <li>Allow camera permissions if prompted</li>
                        </ul>
                      </AlertDescription>
                    </Alert>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md bg-slate-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Appointment Details</h3>
                    <p className="text-sm text-gray-500">
                      ID: HC{foundSchedule.id}
                    </p>
                  </div>
                  <Badge
                    variant={
                      foundSchedule.status === "scheduled"
                        ? "outline"
                        : foundSchedule.status === "in-progress"
                        ? "default"
                        : foundSchedule.status === "completed"
                        ? "secondary"
                        : "destructive"
                    }
                  >
                    {foundSchedule.status.toUpperCase()}
                  </Badge>
                </div>

                <Separator />
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-gray-500">Customer:</p>
                    <p className="font-medium">{foundSchedule.customerName || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Carrier:</p>
                    <p className="font-medium">{foundSchedule.carrierName || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Dock:</p>
                    <p className="font-medium">#{foundSchedule.dockId}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Type:</p>
                    <p className="font-medium">{foundSchedule.type}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Start Time:</p>
                    <p className="font-medium">
                      {format(new Date(foundSchedule.startTime), "MMM d, yyyy h:mm a")}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">End Time:</p>
                    <p className="font-medium">
                      {format(new Date(foundSchedule.endTime), "MMM d, yyyy h:mm a")}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Truck #:</p>
                    <p className="font-medium">{foundSchedule.truckNumber || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Trailer #:</p>
                    <p className="font-medium">{foundSchedule.trailerNumber || "N/A"}</p>
                  </div>
                </div>

                <div className="mt-6">
                  <Button
                    className="w-full"
                    variant={
                      foundSchedule.status === "scheduled" ? "default" : "outline"
                    }
                    disabled={
                      foundSchedule.status !== "scheduled" ||
                      checkInMutation.isPending
                    }
                    onClick={handleCheckIn}
                  >
                    {checkInMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    {foundSchedule.status === "scheduled"
                      ? "Check In"
                      : foundSchedule.status === "in-progress"
                      ? "Already Checked In"
                      : foundSchedule.status === "completed"
                      ? "Appointment Completed"
                      : "Appointment Cancelled"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-center space-x-2">
          <Button
            variant="outline"
            onClick={() => {
              if (foundSchedule) {
                setFoundSchedule(null);
                setConfirmationCode("");
              } else {
                navigate("/");
              }
            }}
          >
            {foundSchedule ? "Back" : "Return Home"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}