import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';

export interface StandardQuestion {
  id: number;
  label: string;
  fieldType: string;
  fieldKey: string;
  required: boolean;
  included: boolean;
  orderPosition: number;
  appointmentTypeId: number;
  options?: string[];
  placeholder?: string;
  defaultValue?: string;
}

export interface QuestionFormField {
  id: number;
  label: string;
  type: string;
  required: boolean;
  included: boolean;
  order: number;
  appointmentType: string;
  options?: string[];
  placeholder?: string;
}

interface StandardQuestionsFormFieldsProps {
  form: UseFormReturn<any>;
  questions: StandardQuestion[];
  isLoading?: boolean;
  existingAnswers?: Record<string, any>;
  fieldNamePrefix?: string;
}

export function StandardQuestionsFormFields({
  form,
  questions,
  isLoading = false,
  existingAnswers = {},
  fieldNamePrefix = ''
}: StandardQuestionsFormFieldsProps) {
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading questions...</span>
      </div>
    );
  }

  // Filter only included questions and sort by order
  const includedQuestions = questions
    .filter(q => q.included)
    .sort((a, b) => (a.orderPosition || 0) - (b.orderPosition || 0));

  if (includedQuestions.length === 0) {
    return (
      <div className="p-4 border border-blue-100 rounded-md bg-blue-50 text-center">
        <p className="text-sm text-blue-700">
          No additional questions are configured for this appointment type.
        </p>
      </div>
    );
  }

  const renderField = (question: StandardQuestion) => {
    const fieldName = fieldNamePrefix ? `${fieldNamePrefix}.${question.fieldKey}` : question.fieldKey;
    const isRequired = question.required;
    const placeholder = question.placeholder || '';
    const defaultValue = existingAnswers[question.fieldKey] || question.defaultValue || '';

    // Set default value if exists
    if (defaultValue && !form.getValues(fieldName)) {
      form.setValue(fieldName, defaultValue);
    }

    switch (question.fieldType?.toLowerCase()) {
      case 'text':
      case 'string':
        return (
          <FormField
            control={form.control}
            name={fieldName}
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {question.label}
                  {isRequired && <span className="text-red-500 ml-1">*</span>}
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder={placeholder}
                    className="w-full"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );

      case 'textarea':
        return (
          <FormField
            control={form.control}
            name={fieldName}
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {question.label}
                  {isRequired && <span className="text-red-500 ml-1">*</span>}
                </FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder={placeholder}
                    rows={3}
                    className="w-full"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );

      case 'number':
        return (
          <FormField
            control={form.control}
            name={fieldName}
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {question.label}
                  {isRequired && <span className="text-red-500 ml-1">*</span>}
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="number"
                    placeholder={placeholder}
                    className="w-full"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );

      case 'email':
        return (
          <FormField
            control={form.control}
            name={fieldName}
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {question.label}
                  {isRequired && <span className="text-red-500 ml-1">*</span>}
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="email"
                    placeholder={placeholder}
                    className="w-full"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );

      case 'phone':
        return (
          <FormField
            control={form.control}
            name={fieldName}
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {question.label}
                  {isRequired && <span className="text-red-500 ml-1">*</span>}
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="tel"
                    placeholder={placeholder}
                    className="w-full"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );

      case 'select':
        return (
          <FormField
            control={form.control}
            name={fieldName}
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {question.label}
                  {isRequired && <span className="text-red-500 ml-1">*</span>}
                </FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={placeholder || "Select an option"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {question.options?.map((option, index) => (
                      <SelectItem key={index} value={option}>
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

      case 'checkbox':
        return (
          <FormField
            control={form.control}
            name={fieldName}
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="text-sm font-normal">
                    {question.label}
                    {isRequired && <span className="text-red-500 ml-1">*</span>}
                  </FormLabel>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        );

      default:
        return (
          <FormField
            control={form.control}
            name={fieldName}
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {question.label}
                  {isRequired && <span className="text-red-500 ml-1">*</span>}
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder={placeholder}
                    className="w-full"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Additional Information</h3>
        <p className="text-sm text-muted-foreground">
          Please provide the following details for your appointment
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {includedQuestions.map((question) => (
          <div key={question.id} className="space-y-2">
            {renderField(question)}
          </div>
        ))}
      </div>
    </div>
  );
}

export default StandardQuestionsFormFields;