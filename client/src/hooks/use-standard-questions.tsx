import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { StandardQuestion } from '@/components/shared/standard-questions-form-fields';

interface UseStandardQuestionsProps {
  appointmentTypeId?: number;
  bookingPageSlug?: string;
}

export function useStandardQuestions({ appointmentTypeId, bookingPageSlug }: UseStandardQuestionsProps) {
  // Create the appropriate query key based on the context
  let endpoint = '';
  if (appointmentTypeId) {
    endpoint = bookingPageSlug 
      ? `/api/custom-questions/${appointmentTypeId}?bookingPageSlug=${bookingPageSlug}`
      : `/api/custom-questions/${appointmentTypeId}`;
  }
  
  const queryKey = [endpoint];
  
  const { 
    data = [], 
    isLoading, 
    error, 
    refetch
  } = useQuery<StandardQuestion[]>({
    queryKey,
    queryFn: async () => {
      if (!appointmentTypeId) return [];
      
      try {
        console.log(`Fetching standard questions for appointment type ${appointmentTypeId}${bookingPageSlug ? ` with booking page ${bookingPageSlug}` : ''}`);
          
        const res = await apiRequest('GET', endpoint);
        
        if (!res.ok) {
          console.error(`Failed to fetch standard questions: ${res.status}`);
          throw new Error(`Failed to fetch standard questions: ${res.status}`);
        }
        
        const questions = await res.json();
        console.log(`Received ${questions.length} standard questions:`, questions);
        return questions;
      } catch (err) {
        console.error('Error fetching standard questions:', err);
        return [];
      }
    },
    enabled: !!appointmentTypeId && endpoint !== '',
  });
  
  return {
    standardQuestions: data,
    isLoading,
    error,
    refetchQuestions: refetch
  };
}