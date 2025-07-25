import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useRoute, Link } from "wouter";
import { Loader2, Calendar, ArrowLeft, CalendarClock, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { getUserTimeZone, getTimeZoneAbbreviation, formatForDualTimeZoneDisplay } from "@shared/timezone-service";
import { Schedule } from "@shared/schema";
import { EnhancedSchedule, canReschedule } from "@/lib/schedule-helpers";
import { 
  useAppointmentAvailability, 
  AvailabilitySlot 
} from "@/hooks/use-appointment-availability-fixed";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { TimeSlotPicker } from "@/components/booking/time-slot-picker";
import { Badge } from "@/components/ui/badge";

// Steps for the reschedule process
const STEPS = {
  LOADING: "loading",
  NOT_FOUND: "not_found",
  APPOINTMENT_DETAILS: "appointment_details",
  SELECT_DATE: "select_date",
  SELECT_TIME: "select_time",
  CONFIRMATION: "confirmation",
};

export default function ReschedulePage() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/reschedule"); // Just to check if we're on the right route
  const { toast } = useToast();
  const { formatTimeRangeForDualZones } = useTimeZoneUtils();
  
  // Get the confirmation code from URL query parameters
  const searchParams = new URLSearchParams(window.location.search);
  const confirmationCode = searchParams.get("code");
  
  // State for the wizard
  const [currentStep, setCurrentStep] = useState(STEPS.LOADING);
  const [schedule, setSchedule] = useState<EnhancedSchedule | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
  const [facilityTimezone, setFacilityTimezone] = useState<string>("America/New_York");
  const [appointmentTypeId, setAppointmentTypeId] = useState<number | null>(null);
  
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
      return response.json() as Promise<EnhancedSchedule>;
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
  const appointmentTypesQuery = useQuery({
    queryKey: ["/api/appointment-types"],
    enabled: !!schedule,
  });
  
  // Use the enhanced appointment availability hook for improved slot data
  const {
    availabilitySlots,
    isLoading: isLoadingAvailability,
    error: availabilityError
  } = useAppointmentAvailability({
    facilityId: schedule?.facilityId || null,
    appointmentTypeId: appointmentTypeId,
    timezone: facilityTimezone,
    facilityTimezone: facilityTimezone,
    date: selectedDate,
  });
  
  // Mutation to reschedule the appointment
  const rescheduleMutation = useMutation({
    mutationFn: async () => {
      if (!schedule || !selectedDate || !selectedTimeSlot) {
        throw new Error("Missing required reschedule information");
      }
      
      const [hour, minute] = selectedTimeSlot.split(":").map(Number);
      const startTime = new Date(selectedDate);
      startTime.setHours(hour, minute, 0, 0);
      
      // Get appointment type for duration
      const appointmentType = Array.isArray(appointmentTypesQuery.data) 
        ? appointmentTypesQuery.data.find((type: any) => type.id === appointmentTypeId)
        : null;
      
      if (!appointmentType) {
        throw new Error("Could not determine appointment duration");
      }
      
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + appointmentType.duration);
      
      const response = await apiRequest("PATCH", `/api/schedules/${schedule.id}/reschedule`, {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      });
      
      if (!response.ok) {
        throw new Error("Failed to reschedule appointment");
      }
      
      return response.json() as Promise<EnhancedSchedule>;
    },
    onSuccess: (updatedSchedule: any) => {
      setSchedule(updatedSchedule);
      setCurrentStep(STEPS.CONFIRMATION);
      toast({
        title: "Appointment Rescheduled",
        description: "Your appointment has been successfully rescheduled.",
      });
      
      // Invalidate any related queries
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Reschedule Failed",
        description: error.message || "Failed to reschedule appointment. Please try again.",
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
      setAppointmentTypeId(scheduleQuery.data.appointmentTypeId);
      
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
  
  // No longer need the effect to update available times since we use the hook directly
  
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
                <div>{schedule.facilityName}</div>
                
                <div className="font-medium text-muted-foreground">Appointment:</div>
                <div>{schedule.appointmentTypeName}</div>
                
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
                disabled={schedule.status !== "scheduled"} 
                onClick={() => setCurrentStep(STEPS.SELECT_DATE)}
              >
                Reschedule This Appointment
              </Button>
              
              {schedule.status !== "scheduled" && (
                <p className="text-sm text-muted-foreground text-center">
                  This appointment cannot be rescheduled because its status is {schedule.status}.
                </p>
              )}
              <Button variant="outline" asChild>
                <Link to="/">Return to Home</Link>
              </Button>
            </div>
          </div>
        );
      
      case STEPS.SELECT_DATE:
        return (
          <div className="p-6">
            <div className="flex items-center mb-4">
              <Button variant="ghost" size="sm" onClick={() => setCurrentStep(STEPS.APPOINTMENT_DETAILS)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <h2 className="text-xl font-bold flex-1 text-center">Select New Date</h2>
              <div className="w-14"></div>
            </div>
            
            <Separator className="mb-6" />
            
            <div className="space-y-6">
              <div className="flex flex-col items-center space-y-2">
                <p className="text-center text-sm text-muted-foreground">
                  Choose a new date for your appointment
                </p>
                <DatePicker
                  date={selectedDate}
                  onSelect={setSelectedDate}
                  disablePastDates
                  className="w-full"
                />
              </div>
              
              <Separator />
              
              <div className="flex justify-end gap-4">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(STEPS.APPOINTMENT_DETAILS)}
                >
                  Cancel
                </Button>
                <Button
                  disabled={!selectedDate}
                  onClick={() => setCurrentStep(STEPS.SELECT_TIME)}
                >
                  Continue
                </Button>
              </div>
            </div>
          </div>
        );
        
      case STEPS.SELECT_TIME:
        return (
          <div className="p-6">
            <div className="flex items-center mb-4">
              <Button variant="ghost" size="sm" onClick={() => setCurrentStep(STEPS.SELECT_DATE)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <h2 className="text-xl font-bold flex-1 text-center">Select New Time</h2>
              <div className="w-14"></div>
            </div>
            
            <Separator className="mb-6" />
            
            <div className="space-y-6">
              <div>
                <p className="text-sm font-medium mb-2">Selected Date:</p>
                <p className="text-lg font-bold mb-4">
                  {selectedDate ? format(selectedDate, "EEEE, MMMM d, yyyy") : "No date selected"}
                </p>
                
                <p className="text-sm font-medium mb-2">Available Times:</p>
                
                {isLoadingAvailability ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : availabilitySlots.length === 0 ? (
                  <div className="text-center py-8 border border-dashed rounded-md">
                    <CalendarClock className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">
                      No available times for this date. Please try another date.
                    </p>
                  </div>
                ) : (
                  <TimeSlotPicker
                    slots={availabilitySlots}
                    selectedTime={selectedTimeSlot}
                    onSelectTime={setSelectedTimeSlot}
                    timezone={facilityTimezone}
                    showRemainingSlots={true}
                  />
                )}
              </div>
              
              <Separator />
              
              <div className="flex justify-end gap-4">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(STEPS.SELECT_DATE)}
                >
                  Back
                </Button>
                <Button
                  disabled={!selectedTimeSlot || rescheduleMutation.isPending}
                  onClick={() => rescheduleMutation.mutate()}
                >
                  {rescheduleMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Rescheduling...
                    </>
                  ) : (
                    "Confirm Reschedule"
                  )}
                </Button>
              </div>
            </div>
          </div>
        );
        
      case STEPS.CONFIRMATION:
        if (!schedule) return null;
        
        return (
          <div className="p-6 text-center">
            <div className="text-primary mb-4">
              <CheckCircle className="h-16 w-16 mx-auto" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Appointment Rescheduled</h2>
            <p className="text-muted-foreground mb-6">
              Your appointment has been successfully rescheduled.
            </p>
            
            <div className="bg-muted/40 p-4 rounded-md mb-6">
              <h3 className="font-bold mb-3">New Appointment Details</h3>
              <div className="space-y-2 text-left">
                <div className="grid grid-cols-[120px_1fr] gap-1">
                  <div className="font-medium text-muted-foreground">Confirmation:</div>
                  <div className="font-bold">HC{schedule.id}</div>
                  
                  <div className="font-medium text-muted-foreground">Date & Time:</div>
                  <div>{formatScheduleTime(schedule)}</div>
                  
                  <div className="font-medium text-muted-foreground">Facility:</div>
                  <div>{schedule.facilityName}</div>
                </div>
              </div>
            </div>
            
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
          <CardTitle>Reschedule Appointment</CardTitle>
          <CardDescription>
            Update your appointment time
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {renderStep()}
        </CardContent>
      </Card>
    </div>
  );
}