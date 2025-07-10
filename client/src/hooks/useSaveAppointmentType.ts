import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export interface SaveAppointmentTypeData {
  id?: number;
  name: string;
  description?: string;
  facilityId: number;
  duration: number;
  color: string;
  type: string;
  maxConcurrent?: number;
  timezone?: string;
  gracePeriod?: number;
  bufferTime?: number;
  maxAppointmentsPerDay?: number;
  emailReminderTime?: number;
  showRemainingSlots?: boolean;
  allowAppointmentsThroughBreaks?: boolean;
  allowAppointmentsPastBusinessHours?: boolean;
  overrideFacilityHours?: boolean;
  questions?: any[];
}

export function useSaveAppointmentType() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const mutation = useMutation({
    mutationFn: async (data: SaveAppointmentTypeData) => {
      const endpoint = data.id 
        ? `/api/appointment-types/${data.id}`
        : '/api/appointment-types';
      
      const method = data.id ? 'PUT' : 'POST';
      
      const response = await apiRequest(method, endpoint, data);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || 'Failed to save appointment type');
      }
      
      const result = await response.json();
      return result;
    },
    onSuccess: (result, variables) => {
      const typeId = variables.id || result.id;
      
      // Invalidate specific booking form schema query as specified
      queryClient.invalidateQueries({ queryKey: ['bookingFormSchema', typeId] });
      
      // Also invalidate general appointment type queries
      queryClient.invalidateQueries({ queryKey: ['appointmentTypes'] });
      queryClient.invalidateQueries({ queryKey: ['appointment-types'] });
      
      toast({
        title: 'Success',
        description: variables.id ? 'Appointment type updated successfully' : 'Appointment type created successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save appointment type',
        variant: 'destructive',
      });
    },
  });

  const saveAppointmentType = async (data: SaveAppointmentTypeData, questions?: any[]) => {
    await mutation.mutateAsync({ ...data, questions });
  };

  return {
    saveAppointmentType,
    mutation,
    isLoading: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
  };
} 