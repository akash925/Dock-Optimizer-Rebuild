import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Loader2, Sprout } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface SeedQuestionsButtonProps {
  appointmentTypeId: number;
  onSuccess?: () => void;
}

export function SeedQuestionsButton({ appointmentTypeId, onSuccess }: SeedQuestionsButtonProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const seedQuestionsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/appointment-types/${appointmentTypeId}/seed-standard`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to seed standard questions');
      }
      
      return response.json();
    },
    onSuccess: (data: any) => {
      // Invalidate TanStack cache for this appointment type
      queryClient.invalidateQueries({ queryKey: ['standard-questions', appointmentTypeId] });
      queryClient.invalidateQueries({ queryKey: ['appointmentType', appointmentTypeId] });
      
      toast({
        title: 'Success',
        description: data.message || 'Standard questions have been seeded successfully',
      });
      
      // Call the success callback if provided
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to seed standard questions',
        variant: 'destructive',
      });
    },
  });

  return (
    <Button 
      onClick={() => seedQuestionsMutation.mutate()}
      disabled={seedQuestionsMutation.isPending}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      {seedQuestionsMutation.isPending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Seeding...
        </>
      ) : (
        <>
          <Sprout className="h-4 w-4" />
          Seed Standard Questions
        </>
      )}
    </Button>
  );
} 