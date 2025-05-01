import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export function useAssignAppointmentToDoor() {
  const { toast } = useToast();
  
  const assignAppointmentMutation = useMutation({
    mutationFn: async ({ 
      scheduleId, 
      dockId 
    }: { 
      scheduleId: number; 
      dockId: number;
    }) => {
      // First, assign the door to the appointment
      const assignResponse = await apiRequest(
        "PATCH", 
        `/api/schedules/${scheduleId}/assign-door`,
        { dockId }
      );
      
      if (!assignResponse.ok) {
        let errorMessage = "Failed to assign appointment to door";
        try {
          const errorData = await assignResponse.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (e) {
          console.error("Error parsing error response:", e);
        }
        throw new Error(errorMessage);
      }
      
      let appointment;
      try {
        appointment = await assignResponse.json();
      } catch (e) {
        console.error("Error parsing response:", e);
        throw new Error("Invalid response received from server");
      }
      
      // Now check-in the appointment to mark it as in-progress
      const checkinResponse = await apiRequest(
        "PATCH",
        `/api/schedules/${scheduleId}/check-in`,
        { actualStartTime: new Date().toISOString() }
      );
      
      if (!checkinResponse.ok) {
        console.warn("Door assigned but failed to check-in appointment automatically");
        // We'll still return the appointment since the door assignment succeeded
        return appointment;
      }
      
      try {
        // Return the checked-in appointment
        return await checkinResponse.json();
      } catch (e) {
        console.error("Error parsing check-in response:", e);
        // Return the original appointment if we can't parse the check-in response
        return appointment;
      }
    },
    onSuccess: () => {
      // Invalidate schedules query to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      
      toast({
        title: "Check-In Complete",
        description: "The appointment has been checked in and assigned to the door",
      });
    },
    onError: (error) => {
      toast({
        title: "Assignment failed",
        description: error instanceof Error ? error.message : "Failed to assign appointment to door",
        variant: "destructive",
      });
    },
  });
  
  return assignAppointmentMutation;
}