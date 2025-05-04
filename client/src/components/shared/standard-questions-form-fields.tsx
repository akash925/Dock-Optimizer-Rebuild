import React from 'react';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { UseFormReturn } from 'react-hook-form';

export interface StandardQuestion {
  id: number;
  label: string;
  required: boolean;
  appointmentTypeId: number;
  fieldKey: string;
  fieldType: 'TEXT' | 'TEXTAREA' | 'SELECT' | 'RADIO' | 'CHECKBOX' | 'FILE' | 'NUMBER' | 'EMAIL' | 'PHONE' | 'DATE';
  included: boolean;
  orderPosition: number;
  options?: string[];
}

interface StandardQuestionsFormFieldsProps {
  form: UseFormReturn<any>;
  questions: StandardQuestion[];
  isLoading?: boolean;
  disabled?: boolean;
}

export function StandardQuestionsFormFields({ 
  form, 
  questions,
  isLoading = false,
  disabled = false 
}: StandardQuestionsFormFieldsProps) {
  if (isLoading) {
    return <div className="py-2">Loading custom questions...</div>;
  }
  
  if (!questions || questions.length === 0) {
    return null;
  }

  // Sort questions by order position
  const sortedQuestions = [...questions].sort((a, b) => a.orderPosition - b.orderPosition);
  
  return (
    <div className="space-y-4 py-2">
      {sortedQuestions.map((question) => {
        // Skip questions that are not included
        if (!question.included) return null;
        
        const fieldName = `customFields.${question.fieldKey}`;
        
        switch (question.fieldType) {
          case 'TEXT':
          case 'EMAIL':
          case 'PHONE':
          case 'NUMBER':
            return (
              <FormField
                key={question.id}
                control={form.control}
                name={fieldName}
                rules={{ required: question.required }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{question.label}{question.required && '*'}</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type={question.fieldType === 'NUMBER' ? 'number' : 'text'} 
                        disabled={disabled}
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
                name={fieldName}
                rules={{ required: question.required }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{question.label}{question.required && '*'}</FormLabel>
                    <FormControl>
                      <Textarea {...field} disabled={disabled} value={field.value || ''} />
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
                name={fieldName}
                rules={{ required: question.required }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{question.label}{question.required && '*'}</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value} 
                      disabled={disabled}
                      value={field.value || ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an option" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {question.options?.map((option) => (
                          <SelectItem key={option} value={option}>
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
                name={fieldName}
                rules={{ required: question.required }}
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>{question.label}{question.required && '*'}</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-col space-y-1"
                        disabled={disabled}
                        value={field.value || ''}
                      >
                        {question.options?.map((option) => (
                          <div key={option} className="flex items-center space-x-2">
                            <RadioGroupItem value={option} id={`${question.fieldKey}-${option}`} />
                            <Label htmlFor={`${question.fieldKey}-${option}`}>{option}</Label>
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
                name={fieldName}
                rules={{ required: question.required }}
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 py-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={disabled}
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
            
          // Add more field types as needed
          default:
            return null;
        }
      })}
    </div>
  );
}