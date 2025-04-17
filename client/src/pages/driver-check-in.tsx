import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Navigate, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, QrCode, Truck } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Schedule } from "@shared/schema";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

export default function DriverCheckIn() {
  const [confirmationCode, setConfirmationCode] = useState("");
  const [_location, navigate] = useLocation();
  const [foundSchedule, setFoundSchedule] = useState<Schedule | null>(null);

  const lookupMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await apiRequest("GET", `/api/schedules/confirmation/${code}`);
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
    onSuccess: () => {
      toast({
        title: "Check-in successful",
        description: "You have been checked in for your appointment.",
      });
      // Reset the form after successful check-in
      setFoundSchedule(null);
      setConfirmationCode("");
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
    
    // Clean up the code if needed (strip any HC prefix)
    const cleanCode = confirmationCode.trim();
    lookupMutation.mutate(cleanCode);
  };

  const handleCheckIn = () => {
    if (foundSchedule) {
      checkInMutation.mutate(foundSchedule.id);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl flex items-center justify-center gap-2">
            <Truck className="h-6 w-6" />
            Driver Check-In
          </CardTitle>
          <CardDescription>
            Enter your appointment confirmation code to check in
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!foundSchedule ? (
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
                        ? "success"
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