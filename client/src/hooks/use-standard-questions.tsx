import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { StandardQuestion } from '@/components/shared/standard-questions-form-fields';

interface UseStandardQuestionsProps {
  appointmentTypeId?: number;
  bookingPageSlug?: string;
}

interface UpdateStandardQuestionParams {
  id: number;
  data: Partial<StandardQuestion>;
}

export function useStandardQuestions({ appointmentTypeId, bookingPageSlug }: UseStandardQuestionsProps) {
  console.log(`[useStandardQuestions] Initializing hook with appointmentTypeId: ${appointmentTypeId}, bookingPageSlug: ${bookingPageSlug}`);
  
  const { data: questions, isLoading, error } = useQuery({
    queryKey: ['standard-questions', appointmentTypeId, bookingPageSlug],
    queryFn: async () => {
      if (!appointmentTypeId) {
        console.log(`[useStandardQuestions] No appointmentTypeId, returning empty array`);
        return [];
      }
      
      // Support both the new and legacy endpoint formats
      // The server has a redirect from /api/standard-questions/:id to /api/standard-questions/appointment-type/:id
      let url = `/api/standard-questions/${appointmentTypeId}`;
      
      // Add booking page slug as a query parameter if provided
      if (bookingPageSlug) {
        url += `?bookingPageSlug=${encodeURIComponent(bookingPageSlug)}`;
      }
      
      console.log(`[useStandardQuestions] Fetching standard questions from: ${url}`);
      
      const response = await apiRequest('GET', url);
      const data = await response.json();
      
      console.log(`[useStandardQuestions] Received ${data.length} questions for appointmentTypeId ${appointmentTypeId}:`, data);
      
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

export function useUpdateStandardQuestion() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: UpdateStandardQuestionParams) => {
      // Debug the data we're sending
      console.log(`[StandardQuestion] Sending update for ID ${id}:`, data);
      
      const response = await apiRequest('PUT', `/api/standard-questions/${id}`, data);
      
      if (!response.ok) {
        // Parse error response
        let errorMessage = 'Unknown error occurred';
        try {
          const errorData = await response.json();
          console.error(`[StandardQuestion] Update error for ID ${id}:`, errorData);
          errorMessage = errorData.message || `Failed to update standard question: ${response.statusText}`;
        } catch (e) {
          console.error(`[StandardQuestion] Error parsing response:`, e);
          errorMessage = `Failed to update standard question (${response.status}): ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }
      
      const result = await response.json();
      console.log(`[StandardQuestion] Successfully updated ID ${id}:`, result);
      return result;
    },
    onSuccess: (data, { id }) => {
      // Get appointment type ID from the updated question
      const appointmentTypeId = data.appointmentTypeId;
      
      console.log(`[StandardQuestion] Invalidating cache for appointment type ${appointmentTypeId}`);
      
      // Invalidate the standard questions query to refetch the updated data
      queryClient.invalidateQueries({ queryKey: ['standard-questions', appointmentTypeId] });
      
      // Also invalidate any query that might be using this specific question
      queryClient.invalidateQueries({ queryKey: ['standard-questions', 'detail', id] });
    }
  });
}