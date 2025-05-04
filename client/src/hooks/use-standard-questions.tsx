import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { StandardQuestion } from '@/components/shared/standard-questions-form-fields';

interface UseStandardQuestionsProps {
  appointmentTypeId?: number;
  bookingPageSlug?: string;
}

export function useStandardQuestions({ appointmentTypeId, bookingPageSlug }: UseStandardQuestionsProps) {
  // Create the appropriate query key based on the context
  const queryKey = bookingPageSlug 
    ? [`/api/booking-pages/slug/${bookingPageSlug}/appointment-types/${appointmentTypeId}/questions`]
    : [`/api/appointment-types/${appointmentTypeId}/questions`];
  
  const { 
    data = [], 
    isLoading, 
    error 
  } = useQuery<StandardQuestion[]>({
    queryKey,
    queryFn: async () => {
      if (!appointmentTypeId) return [];
      
      try {
        // Choose the appropriate endpoint based on context
        const endpoint = bookingPageSlug
          ? `/api/booking-pages/slug/${bookingPageSlug}/appointment-types/${appointmentTypeId}/questions`
          : `/api/appointment-types/${appointmentTypeId}/questions`;
          
        const res = await apiRequest('GET', endpoint);
        
        if (!res.ok) {
          throw new Error(`Failed to fetch standard questions: ${res.status}`);
        }
        
        return await res.json();
      } catch (err) {
        console.error('Error fetching standard questions:', err);
        return [];
      }
    },
    enabled: !!appointmentTypeId,
  });
  
  return {
    standardQuestions: data,
    isLoading,
    error
  };
}