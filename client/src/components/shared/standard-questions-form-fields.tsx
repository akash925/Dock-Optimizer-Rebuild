import React from 'react';
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UseFormReturn } from 'react-hook-form';
import { StandardQuestion } from '@/hooks/use-standard-questions';
import { z } from 'zod';

interface StandardQuestionsFormFieldsProps {
  form: UseFormReturn<any>;
  standardQuestions: StandardQuestion[];
  isLoading: boolean;
}

export const StandardQuestionsFormFields: React.FC<StandardQuestionsFormFieldsProps> = ({ 
  form,
  standardQuestions,
  isLoading
}) => {
  if (isLoading) {
    return <div className="py-2 text-sm text-muted-foreground">Loading additional questions...</div>;
  }

  if (!standardQuestions?.length) {
    return null;
  }

  // To track if we've already rendered the built-in fields
  const renderedKeys = new Set<string>();

  return (
    <div className="space-y-4">
      {standardQuestions
        .filter(question => question.included)
        .map(question => {
          // Skip if we've already rendered this field (useful for built-in fields)
          if (renderedKeys.has(question.fieldKey)) {
            return null;
          }
          renderedKeys.add(question.fieldKey);

          return (
            <FormField
              key={question.id}
              control={form.control}
              name={question.fieldKey}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {question.label}
                    {question.required && '*'}
                  </FormLabel>
                  <FormControl>
                    {renderFieldInput(question, field, form)}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          );
        })}
    </div>
  );
};

// Helper function to render different input types based on fieldType
function renderFieldInput(question: StandardQuestion, field: any, form: UseFormReturn<any>) {
  const { fieldType } = question;

  switch (fieldType) {
    case 'TEXT':
      return (
        <Input
          placeholder={`Enter ${question.label.toLowerCase()}`}
          {...field}
          value={field.value || ''}
        />
      );
    case 'PHONE':
      return (
        <Input
          placeholder="(555) 555-5555"
          type="tel"
          {...field}
          value={field.value || ''}
        />
      );
    case 'EMAIL':
      return (
        <Input
          placeholder="email@example.com"
          type="email"
          {...field}
          value={field.value || ''}
        />
      );
    case 'NUMBER':
      return (
        <Input
          placeholder="0"
          type="number"
          {...field}
          value={field.value || ''}
          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : '')}
        />
      );
    case 'CHECKBOX':
      return (
        <Checkbox
          checked={field.value}
          onCheckedChange={field.onChange}
        />
      );
    case 'SELECT':
      // For simplicity, using a hardcoded set of options
      // In a real implementation, options would come from the question configuration
      return (
        <Select
          value={field.value || ''}
          onValueChange={field.onChange}
        >
          <SelectTrigger>
            <SelectValue placeholder={`Select ${question.label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
            <SelectItem value="option2">Option 2</SelectItem>
            <SelectItem value="option3">Option 3</SelectItem>
          </SelectContent>
        </Select>
      );
    default:
      return (
        <Input
          placeholder={`Enter ${question.label.toLowerCase()}`}
          {...field}
          value={field.value || ''}
        />
      );
  }
}