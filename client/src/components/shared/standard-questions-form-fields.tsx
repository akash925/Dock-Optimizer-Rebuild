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
  // Additional optional properties that might be in the API response
  order?: number; // Some APIs use order instead of orderPosition
}

interface StandardQuestionsFormFieldsProps {
  form?: UseFormReturn<any>;
  questions: StandardQuestion[];
  isLoading?: boolean;
  disabled?: boolean;
  onAnswersChange?: (answers: Record<string, any>) => void;
  existingAnswers?: Record<string, any>;
}

export function StandardQuestionsFormFields({ 
  form, 
  questions,
  isLoading = false,
  disabled = false,
  onAnswersChange,
  existingAnswers = {}
}: StandardQuestionsFormFieldsProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-6">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading questions...</span>
      </div>
    );
  }
  
  // Show a helpful message if no questions are available
  if (!questions || !questions.length) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        <p>No standard questions are configured for this appointment type.</p>
      </div>
    );
  }

  // Add defensive coding to handle potentially malformed questions
  // First make sure each question has the required properties
  const validQuestions = questions.filter(q => {
    // Basic error checking
    if (!q) return false;
    
    // Check if required properties exist
    const hasRequiredProps = typeof q.id === 'number' && 
                            typeof q.fieldKey === 'string' && 
                            typeof q.label === 'string';
    
    // Handle missing included property
    if (hasRequiredProps && typeof q.included === 'undefined') {
      console.log(`[StandardQuestionsFormFields] Question ${q.id} (${q.label}) missing included property, assuming true`);
      q.included = true;
    }
    
    // Handle missing orderPosition property
    if (hasRequiredProps && typeof q.orderPosition === 'undefined' && typeof q.order !== 'undefined') {
      console.log(`[StandardQuestionsFormFields] Question ${q.id} (${q.label}) using order property instead of orderPosition`);
      q.orderPosition = (q as any).order;
    }
    
    return hasRequiredProps;
  });
  
  // Log if any questions were filtered out
  if (questions.length !== validQuestions.length) {
    console.warn(`[StandardQuestionsFormFields] Filtered out ${questions.length - validQuestions.length} invalid questions`);
  }
  
  // Sort questions by order position and ONLY include questions marked as included=true
  // First, categorize questions by type to prioritize shipment/appointment fields
  const sortedQuestions = [...validQuestions]
    .filter(q => q.included) // Only include questions that have included=true
    .sort((a, b) => {
      // Priority order:
      // 1. Appointment/shipment related fields first (use fieldKey pattern matching)
      // 2. Then sort by orderPosition for same category
      
      // Make sure orderPosition exists and is numeric
      const orderPositionA = typeof a.orderPosition === 'number' ? a.orderPosition : 
                           typeof a.order === 'number' ? a.order : 999;
      const orderPositionB = typeof b.orderPosition === 'number' ? b.orderPosition : 
                           typeof b.order === 'number' ? b.order : 999;
      
      // Check if fields are appointment/shipment related
      const isAppointmentFieldA = /^(appointment|shipment|schedule|bol|truck|trailer|container|cargo|driver)/i.test(a.fieldKey);
      const isAppointmentFieldB = /^(appointment|shipment|schedule|bol|truck|trailer|container|cargo|driver)/i.test(b.fieldKey);
      
      // Different categories - prioritize appointment fields
      if (isAppointmentFieldA && !isAppointmentFieldB) return -1;
      if (!isAppointmentFieldA && isAppointmentFieldB) return 1;
      
      // Same category - sort by orderPosition
      return orderPositionA - orderPositionB;
    });
  
  // Enhanced debug logging
  if (questions.length > 0) {
    console.log('[StandardQuestionsFormFields] All questions (' + questions.length + '):', questions);
    console.log('[StandardQuestionsFormFields] Filtered questions with included=true (' + sortedQuestions.length + '):', 
      sortedQuestions);
    console.log('[StandardQuestionsFormFields] Excluded questions with included=false (' + questions.filter(q => !q.included).length + '):', 
      questions.filter(q => !q.included));
    
    // Log which questions were identified as appointment/shipment related
    const appointmentRelatedQuestions = sortedQuestions.filter(q => 
      /^(appointment|shipment|schedule|bol|truck|trailer|container|cargo|driver)/i.test(q.fieldKey)
    );
    console.log('[StandardQuestionsFormFields] Appointment-related questions (' + appointmentRelatedQuestions.length + '):', 
      appointmentRelatedQuestions.map(q => `${q.id} - ${q.fieldKey} - ${q.label}`));
    
    // Log the first few questions to verify ordering
    console.log('[StandardQuestionsFormFields] Questions order after prioritizing appointment fields:',
      sortedQuestions.slice(0, 5).map(q => `${q.id} - ${q.fieldKey} - ${q.label}`));
  }

  // Debug logging before rendering
  console.log('[StandardQuestionsFormFields] About to render questions. Questions count after filtering:', sortedQuestions.length);
  console.log('[StandardQuestionsFormFields] First few questions after filtering:', sortedQuestions.slice(0, 5));

  // Use standalone mode if form is not provided
  const [answers, setAnswers] = React.useState<Record<string, any>>(existingAnswers || {});
  
  React.useEffect(() => {
    // If onAnswersChange callback is provided, send updated answers
    if (onAnswersChange) {
      onAnswersChange(answers);
    }
  }, [answers, onAnswersChange]);
  
  const handleStandaloneChange = (key: string, value: any) => {
    setAnswers(prev => {
      const newAnswers = { ...prev, [key]: value };
      return newAnswers;
    });
  };

  if (!form) {
    // Standalone mode
    return (
      <div className="space-y-4">
        {sortedQuestions.map((question) => {
          const fieldKey = question.fieldKey;
          const value = answers[fieldKey] || '';
          
          return (
            <div key={question.id} className="space-y-2">
              <Label htmlFor={fieldKey}>
                {question.label}
                {question.required && <span className="text-destructive ml-1">*</span>}
              </Label>
              {renderFormControl(question, {
                value: value,
                onChange: (e: any) => handleStandaloneChange(fieldKey, 
                  e?.target ? e.target.value : e),
                id: fieldKey,
                disabled: disabled
              }, disabled)}
              {question.required && (
                <p className="text-xs text-muted-foreground">This field is required</p>
              )}
            </div>
          );
        })}
      </div>
    );
  }
  
  // Form-controlled mode
  return (
    <div className="space-y-4">
      {sortedQuestions.map((question) => {
        // Use the field key as the name in the form
        const fieldName = `customFields.${question.fieldKey}`;
        
        // Debug each question as we process it
        console.log(`[StandardQuestionsFormFields] Rendering question ID ${question.id} - ${question.label}`);
        
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
                  {/* Show only included questions */}
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