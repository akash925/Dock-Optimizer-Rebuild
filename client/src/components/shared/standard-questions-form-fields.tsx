import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormDescription } from '@/components/ui/form';
import { Loader2 } from 'lucide-react';

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
    return (
      <div className="flex justify-center items-center py-6">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading questions...</span>
      </div>
    );
  }
  
  if (!questions.length) {
    return null;
  }

  // Sort questions by order position
  const sortedQuestions = [...questions].sort((a, b) => a.orderPosition - b.orderPosition);
  
  return (
    <div className="space-y-4">
      {sortedQuestions
        .filter(q => q.included) // Only show questions that are included
        .map((question) => {
          // Use the field key as the name in the form
          const fieldName = `customFields.${question.fieldKey}`;
          
          return (
            <FormField
              key={question.id}
              control={form.control}
              name={fieldName}
              rules={{ required: question.required ? `${question.label} is required` : false }}
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel>
                    {question.label}
                    {question.required && <span className="text-destructive ml-1">*</span>}
                  </FormLabel>
                  
                  <FormControl>
                    {renderFormControl(question, field, disabled)}
                  </FormControl>
                  
                  <FormMessage />
                </FormItem>
              )}
            />
          );
      })}
    </div>
  );
}

function renderFormControl(question: StandardQuestion, field: any, disabled: boolean) {
  const { fieldType, options = [] } = question;
  
  switch (fieldType) {
    case 'TEXT':
      return <Input {...field} disabled={disabled} />;
      
    case 'TEXTAREA':
      return <Textarea {...field} disabled={disabled} className="min-h-20" />;
    
    case 'EMAIL':
      return <Input {...field} type="email" disabled={disabled} />;
      
    case 'PHONE':
      return <Input {...field} type="tel" disabled={disabled} />;
      
    case 'NUMBER':
      return <Input 
        {...field} 
        type="number" 
        disabled={disabled}
        onChange={(e) => field.onChange(e.target.valueAsNumber || '')}
      />;
      
    case 'DATE':
      return <Input 
        {...field} 
        type="date" 
        disabled={disabled} 
        onChange={(e) => field.onChange(e.target.value || '')}
      />;
      
    case 'SELECT':
      return (
        <Select
          onValueChange={field.onChange}
          defaultValue={field.value}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            {options.map((option, index) => (
              <SelectItem key={index} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
      
    case 'RADIO':
      return (
        <RadioGroup
          onValueChange={field.onChange}
          defaultValue={field.value}
          disabled={disabled}
          className="flex flex-col space-y-1"
        >
          {options.map((option, index) => (
            <div key={index} className="flex items-center space-x-2">
              <RadioGroupItem value={option} id={`${question.fieldKey}-${index}`} />
              <Label htmlFor={`${question.fieldKey}-${index}`}>{option}</Label>
            </div>
          ))}
        </RadioGroup>
      );
      
    case 'CHECKBOX':
      // For checkbox groups, we need special handling
      return (
        <div className="flex flex-col space-y-2">
          {options.map((option, index) => (
            <div key={index} className="flex items-center space-x-2">
              <Checkbox
                id={`${question.fieldKey}-${index}`}
                checked={(field.value || []).includes(option)}
                onCheckedChange={(checked) => {
                  const currentValues = field.value || [];
                  if (checked) {
                    field.onChange([...currentValues, option]);
                  } else {
                    field.onChange(currentValues.filter((value: string) => value !== option));
                  }
                }}
                disabled={disabled}
              />
              <Label htmlFor={`${question.fieldKey}-${index}`}>{option}</Label>
            </div>
          ))}
        </div>
      );
      
    case 'FILE':
      // This is a simplified version; we'd need more handling for file uploads
      return <Input
        type="file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          field.onChange(file || null);
        }}
        disabled={disabled}
      />;
      
    default:
      return <Input {...field} disabled={disabled} />;
  }
}