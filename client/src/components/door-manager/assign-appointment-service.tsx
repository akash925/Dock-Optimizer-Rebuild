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
      const response = await apiRequest(
        "PATCH", 
        `/api/schedules/${scheduleId}/assign-door`,
        { dockId }
      );
      
      if (!response.ok) {
        let errorMessage = "Failed to assign appointment to door";
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (e) {
          console.error("Error parsing error response:", e);
        }
        throw new Error(errorMessage);
      }
      
      try {
        return await response.json();
      } catch (e) {
        console.error("Error parsing response:", e);
        throw new Error("Invalid response received from server");
      }
    },
    onSuccess: () => {
      // Invalidate schedules query to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      
      toast({
        title: "Appointment assigned",
        description: "The appointment has been successfully assigned to the door",
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