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
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to assign appointment to door");
      }
      
      return await response.json();
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