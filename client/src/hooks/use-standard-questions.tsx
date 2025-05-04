import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { StandardQuestion } from '@/components/shared/standard-questions-form-fields';

interface UseStandardQuestionsProps {
  appointmentTypeId?: number;
  bookingPageSlug?: string;
}

export function useStandardQuestions({ appointmentTypeId, bookingPageSlug }: UseStandardQuestionsProps) {
  const { data: questions, isLoading, error } = useQuery({
    queryKey: ['custom-questions', appointmentTypeId, bookingPageSlug],
    queryFn: async () => {
      if (!appointmentTypeId) {
        return [];
      }
      
      let url = `/api/custom-questions/${appointmentTypeId}`;
      
      // Add booking page slug as a query parameter if provided
      if (bookingPageSlug) {
        url += `?bookingPageSlug=${encodeURIComponent(bookingPageSlug)}`;
      }
      
      const response = await apiRequest('GET', url);
      const data = await response.json();
      
      // Ensure options are correctly handled (convert from JSON string if needed)
      return data.map((question: any) => {
        // Handle options coming as string (JSON) instead of array
        if (question.options && typeof question.options === 'string') {
          try {
            question.options = JSON.parse(question.options);
          } catch (e) {
            console.error(`Error parsing options for question ${question.id}:`, e);
            question.options = [];
          }
        }
        
        // Ensure options is always an array
        if (!question.options) {
          question.options = [];
        }
        
        return question;
      }) as StandardQuestion[];
    },
    enabled: !!appointmentTypeId,
    staleTime: 30000, // 30 seconds before refetching
  });

  return {
    questions: questions || [],
    isLoading,
    error
  };
}