import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export interface StandardQuestion {
  id: number;
  appointmentTypeId: number;
  fieldKey: string;
  label: string;
  fieldType: 'TEXT' | 'SELECT' | 'CHECKBOX' | 'PHONE' | 'EMAIL' | 'NUMBER';
  included: boolean;
  required: boolean;
  orderPosition: number;
  createdAt: string;
}

interface UseStandardQuestionsProps {
  appointmentTypeId?: number;
  bookingPageSlug?: string;
}

export const useStandardQuestions = ({ 
  appointmentTypeId, 
  bookingPageSlug 
}: UseStandardQuestionsProps) => {
  const [standardQuestions, setStandardQuestions] = useState<StandardQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchStandardQuestions = async () => {
      if (!appointmentTypeId) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        // Build URL with optional booking page slug
        let url = `/api/standard-questions/${appointmentTypeId}`;
        if (bookingPageSlug) {
          url += `?bookingPageSlug=${encodeURIComponent(bookingPageSlug)}`;
        }
        
        const res = await apiRequest('GET', url);
        if (!res.ok) {
          throw new Error('Failed to fetch standard questions');
        }
        
        const data = await res.json();
        console.log('Fetched standard questions:', data);
        
        // Sort by orderPosition
        const sortedQuestions = [...data].sort((a, b) => a.orderPosition - b.orderPosition);
        setStandardQuestions(sortedQuestions);
      } catch (err) {
        console.error('Error fetching standard questions:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
        toast({
          title: 'Error',
          description: 'Failed to load standard questions',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchStandardQuestions();
  }, [appointmentTypeId, bookingPageSlug, toast]);

  return {
    standardQuestions,
    isLoading,
    error
  };
};