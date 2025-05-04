import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

// Define a type for standard question
export interface StandardQuestion {
  id: number;
  label: string;
  required: boolean;
  fieldKey: string;
  fieldType: 'TEXT' | 'TEXTAREA' | 'SELECT' | 'RADIO' | 'CHECKBOX' | 'FILE' | 'NUMBER' | 'EMAIL' | 'PHONE' | 'DATE';
  appointmentTypeId: number;
  options?: string[] | null;
  included: boolean;
  orderPosition: number;
}

interface StandardQuestionsFormFieldsProps {
  form: UseFormReturn<any>;
  standardQuestions: StandardQuestion[];
  isLoading: boolean;
}

export function StandardQuestionsFormFields({
  form,
  standardQuestions,
  isLoading
}: StandardQuestionsFormFieldsProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading questions...</span>
      </div>
    );
  }

  if (!standardQuestions || standardQuestions.length === 0) {
    return null;
  }

  // Sort questions by orderPosition
  const sortedQuestions = [...standardQuestions].sort((a, b) => a.orderPosition - b.orderPosition);

  return (
    <div className="space-y-4">
      {sortedQuestions.map((question) => {
        if (!question.included) return null;

        // Handle field type
        switch (question.fieldType) {
          case 'TEXT':
            return (
              <FormField
                key={question.id}
                control={form.control}
                name={`standardQuestions.${question.fieldKey}`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{question.label}{question.required && '*'}</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder={`Enter ${question.label.toLowerCase()}`} 
                        {...field} 
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            );

          case 'TEXTAREA':
            return (
              <FormField
                key={question.id}
                control={form.control}
                name={`standardQuestions.${question.fieldKey}`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{question.label}{question.required && '*'}</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder={`Enter ${question.label.toLowerCase()}`} 
                        {...field} 
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            );

          case 'SELECT':
            return (
              <FormField
                key={question.id}
                control={form.control}
                name={`standardQuestions.${question.fieldKey}`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{question.label}{question.required && '*'}</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={`Select ${question.label.toLowerCase()}`} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {question.options && question.options.map((option, index) => (
                          <SelectItem key={`${question.id}-${index}`} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            );

          case 'RADIO':
            return (
              <FormField
                key={question.id}
                control={form.control}
                name={`standardQuestions.${question.fieldKey}`}
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>{question.label}{question.required && '*'}</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-col space-y-1"
                      >
                        {question.options && question.options.map((option, index) => (
                          <div key={`${question.id}-${index}`} className="flex items-center space-x-2">
                            <RadioGroupItem value={option} id={`${question.fieldKey}-${index}`} />
                            <Label htmlFor={`${question.fieldKey}-${index}`}>{option}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            );

          case 'CHECKBOX':
            return (
              <FormField
                key={question.id}
                control={form.control}
                name={`standardQuestions.${question.fieldKey}`}
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>{question.label}{question.required && '*'}</FormLabel>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            );

          case 'NUMBER':
            return (
              <FormField
                key={question.id}
                control={form.control}
                name={`standardQuestions.${question.fieldKey}`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{question.label}{question.required && '*'}</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder={`Enter ${question.label.toLowerCase()}`} 
                        {...field} 
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            );

          case 'EMAIL':
            return (
              <FormField
                key={question.id}
                control={form.control}
                name={`standardQuestions.${question.fieldKey}`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{question.label}{question.required && '*'}</FormLabel>
                    <FormControl>
                      <Input 
                        type="email" 
                        placeholder={`Enter ${question.label.toLowerCase()}`} 
                        {...field} 
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            );

          case 'PHONE':
            return (
              <FormField
                key={question.id}
                control={form.control}
                name={`standardQuestions.${question.fieldKey}`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{question.label}{question.required && '*'}</FormLabel>
                    <FormControl>
                      <Input 
                        type="tel" 
                        placeholder={`Enter ${question.label.toLowerCase()}`} 
                        {...field} 
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            );

          case 'DATE':
            return (
              <FormField
                key={question.id}
                control={form.control}
                name={`standardQuestions.${question.fieldKey}`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{question.label}{question.required && '*'}</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field} 
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            );

          default:
            return null;
        }
      })}
    </div>
  );
}