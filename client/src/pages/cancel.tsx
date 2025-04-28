import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useRoute, Link } from "wouter";
import { Loader2, Calendar, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { useTimeZoneUtils } from "@/hooks/use-timezone-utils";
import { Schedule } from "@shared/schema";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";

// Steps for the cancel process
const STEPS = {
  LOADING: "loading",
  NOT_FOUND: "not_found",
  APPOINTMENT_DETAILS: "appointment_details",
  CONFIRMATION: "confirmation",
};

export default function CancelPage() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/cancel"); // Just to check if we're on the right route
  const { toast } = useToast();
  const { formatTimeRangeForDualZones } = useTimeZoneUtils();
  
  // Get the confirmation code from URL query parameters
  const searchParams = new URLSearchParams(window.location.search);
  const confirmationCode = searchParams.get("code");
  
  // State for the wizard
  const [currentStep, setCurrentStep] = useState(STEPS.LOADING);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [facilityTimezone, setFacilityTimezone] = useState<string>("America/New_York");
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  
  // Query to look up the schedule by confirmation code
  const scheduleQuery = useQuery({
    queryKey: ["/api/schedules/confirmation", confirmationCode],
    queryFn: async () => {
      if (!confirmationCode) {
        throw new Error("No confirmation code provided");
      }
      const cleanCode = confirmationCode.replace(/^HC/, "");
      const response = await apiRequest("GET", `/api/schedules/confirmation/${cleanCode}`);
      if (!response.ok) {
        throw new Error("Schedule not found");
      }
      return response.json() as Promise<Schedule>;
    },
    enabled: !!confirmationCode,
    retry: false,
  });
  
  // Query to fetch facilities
  const facilitiesQuery = useQuery({
    queryKey: ["/api/facilities"],
    enabled: !!schedule?.facilityId,
  });
  
  // Query to fetch appointment types
  const appointmentTypes = useQuery({
    queryKey: ["/api/appointment-types"],
    enabled: !!schedule?.appointmentTypeId,
  });
  
  // Mutation to cancel the appointment
  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!schedule) {
        throw new Error("No appointment selected");
      }
      
      const response = await apiRequest("PATCH", `/api/schedules/${schedule.id}/cancel`, {
        reason: cancelReason || "Cancelled by user"
      });
      
      if (!response.ok) {
        throw new Error("Failed to cancel appointment");
      }
      
      return response.json() as Promise<Schedule>;
    },
    onSuccess: (updatedSchedule) => {
      setSchedule(updatedSchedule);
      setCurrentStep(STEPS.CONFIRMATION);
      toast({
        title: "Appointment Cancelled",
        description: "Your appointment has been successfully cancelled.",
      });
      
      // Invalidate any related queries
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Cancellation Failed",
        description: error.message || "Failed to cancel appointment. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  // Effect to handle the initial schedule lookup
  useEffect(() => {
    if (scheduleQuery.isPending) {
      setCurrentStep(STEPS.LOADING);
    } else if (scheduleQuery.isError) {
      setCurrentStep(STEPS.NOT_FOUND);
    } else if (scheduleQuery.data) {
      setSchedule(scheduleQuery.data);
      
      // Set the facility timezone
      if (facilitiesQuery.data) {
        const facility = Array.isArray(facilitiesQuery.data)
          ? facilitiesQuery.data.find((f: any) => f.id === scheduleQuery.data.facilityId)
          : null;
        
        if (facility?.timezone) {
          setFacilityTimezone(facility.timezone);
        }
      }
      
      setCurrentStep(STEPS.APPOINTMENT_DETAILS);
    }
  }, [scheduleQuery.status, scheduleQuery.data, facilitiesQuery.data]);
  
  // Helper to format dates/times
  const formatScheduleTime = (schedule: Schedule) => {
    if (!schedule.startTime || !schedule.endTime) return "Time not scheduled";
    
    const start = new Date(schedule.startTime);
    const end = new Date(schedule.endTime);
    const dateStr = format(start, "EEEE, MMMM d, yyyy");
    
    // Get the time ranges in both user and facility timezones
    const { userTimeRange, facilityTimeRange, userZoneAbbr, facilityZoneAbbr } = 
      formatTimeRangeForDualZones(start, end, facilityTimezone);
    
    return (
      <div className="space-y-1">
        <div>{dateStr}</div>
        <div>
          <span className="font-medium">Facility time:</span> {facilityTimeRange} ({facilityZoneAbbr})
        </div>
        <div>
          <span className="font-medium">Your local time:</span> {userTimeRange} ({userZoneAbbr})
        </div>
      </div>
    );
  };
  
  // Helper to get facility name, handling data model inconsistencies
  const getFacilityName = (schedule: any): string => {
    // Try all possible property names for facility
    if (typeof schedule.facilityName === 'string') {
      return schedule.facilityName;
    }
    
    if (typeof schedule.facility?.name === 'string') {
      return schedule.facility.name;
    }
    
    if (facilitiesQuery.data && schedule.facilityId) {
      const facility = facilitiesQuery.data.find((f: any) => f.id === schedule.facilityId);
      if (facility) {
        return facility.name;
      }
    }
    
    return "Unknown Facility";
  };
  
  // Helper to get appointment type name, handling data model inconsistencies
  const getAppointmentTypeName = (schedule: any): string => {
    // Try all possible property names for appointment type
    if (typeof schedule.appointmentTypeName === 'string') {
      return schedule.appointmentTypeName;
    }
    
    if (typeof schedule.appointmentType?.name === 'string') {
      return schedule.appointmentType.name;
    }
    
    if (appointmentTypes.data && schedule.appointmentTypeId) {
      const appointmentType = appointmentTypes.data.find((t: any) => t.id === schedule.appointmentTypeId);
      if (appointmentType) {
        return appointmentType.name;
      }
    }
    
    return schedule.type === "inbound" ? "Inbound Appointment" : 
           schedule.type === "outbound" ? "Outbound Appointment" : 
           "Standard Appointment";
  };
  
  // Render based on the current step
  const renderStep = () => {
    switch (currentStep) {
      case STEPS.LOADING:
        return (
          <div className="flex flex-col items-center justify-center p-8">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-center text-muted-foreground">
              Looking up your appointment...
            </p>
          </div>
        );
        
      case STEPS.NOT_FOUND:
        return (
          <div className="p-6 text-center">
            <div className="text-destructive mb-4">
              <Calendar className="h-16 w-16 mx-auto" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Appointment Not Found</h2>
            <p className="text-muted-foreground mb-6">
              We couldn't find an appointment with the provided confirmation code.
            </p>
            <Button className="w-full" asChild>
              <Link to="/">Return to Home</Link>
            </Button>
          </div>
        );
        
      case STEPS.APPOINTMENT_DETAILS:
        if (!schedule) return null;
        
        return (
          <div className="p-6">
            <h2 className="text-xl font-bold mb-4">Current Appointment Details</h2>
            
            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-[120px_1fr] gap-2">
                <div className="font-medium text-muted-foreground">Confirmation:</div>
                <div className="font-bold">HC{schedule.id}</div>
                
                <div className="font-medium text-muted-foreground">Date & Time:</div>
                <div>{formatScheduleTime(schedule)}</div>
                
                <div className="font-medium text-muted-foreground">Facility:</div>
                <div>{getFacilityName(schedule)}</div>
                
                <div className="font-medium text-muted-foreground">Appointment:</div>
                <div>{getAppointmentTypeName(schedule)}</div>
                
                <div className="font-medium text-muted-foreground">Status:</div>
                <div>
                  <Badge variant={schedule.status === "scheduled" ? "default" : "secondary"}>
                    {schedule.status === "scheduled" ? "Scheduled" : 
                     schedule.status === "in-progress" ? "In Progress" : 
                     schedule.status === "completed" ? "Completed" : "Cancelled"}
                  </Badge>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col gap-4">
              <Button 
                variant="destructive"
                disabled={schedule.status !== "scheduled"} 
                onClick={() => setIsCancelDialogOpen(true)}
              >
                Cancel This Appointment
              </Button>
              
              {schedule.status !== "scheduled" && (
                <p className="text-sm text-muted-foreground text-center">
                  This appointment cannot be cancelled because its status is {schedule.status}.
                </p>
              )}
              
              <Button variant="outline" asChild>
                <Link to="/">Return to Home</Link>
              </Button>
            </div>
            
            <AlertDialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel Appointment</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to cancel this appointment? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                
                <div className="py-3">
                  <label htmlFor="cancel-reason" className="text-sm font-medium mb-2 block">
                    Reason for cancellation (optional):
                  </label>
                  <Textarea
                    id="cancel-reason"
                    placeholder="Please provide a reason for cancellation"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="w-full"
                  />
                </div>
                
                <AlertDialogFooter>
                  <AlertDialogCancel>No, keep appointment</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={(e) => {
                      e.preventDefault();
                      cancelMutation.mutate();
                      setIsCancelDialogOpen(false);
                    }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {cancelMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Cancelling...
                      </>
                    ) : (
                      "Yes, cancel appointment"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        );
      
      case STEPS.CONFIRMATION:
        return (
          <div className="p-6 text-center">
            <div className="text-destructive mb-4">
              <AlertCircle className="h-16 w-16 mx-auto" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Appointment Cancelled</h2>
            <p className="text-muted-foreground mb-6">
              Your appointment has been successfully cancelled.
            </p>
            
            <Button className="w-full" asChild>
              <Link to="/">Return to Home</Link>
            </Button>
          </div>
        );
    }
  };
  
  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-slate-50">
      <Card className="w-full max-w-xl shadow-lg">
        <CardHeader className="text-center border-b pb-4">
          <CardTitle>Cancel Appointment</CardTitle>
          <CardDescription>
            Review and cancel your scheduled appointment
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {renderStep()}
        </CardContent>
      </Card>
    </div>
  );
}