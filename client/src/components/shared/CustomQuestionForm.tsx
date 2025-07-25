import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

// Define the form schema with zod
const questionFormSchema = z.object({
  label: z.string().min(2, 'Label must be at least 2 characters').max(100),
  fieldKey: z.string().min(2, 'Field key must be at least 2 characters').max(50)
    .regex(/^[a-zA-Z0-9_]+$/, 'Field key can only contain letters, numbers, and underscores'),
  fieldType: z.enum(['TEXT', 'TEXTAREA', 'SELECT', 'RADIO', 'CHECKBOX', 'NUMBER', 'EMAIL', 'PHONE', 'DATE']),
  required: z.boolean().default(false),
  included: z.boolean().default(true),
  options: z.string().optional(),
  orderPosition: z.number().int().positive().default(1),
  appointmentTypeId: z.number().int().positive()
});

type QuestionFormValues = z.infer<typeof questionFormSchema>;

interface CustomQuestionFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (question: QuestionFormValues) => void;
  appointmentTypeId: number;
  existingQuestion?: any;
  isEdit?: boolean;
}

export function CustomQuestionForm({
  open,
  onClose,
  onSave,
  appointmentTypeId,
  existingQuestion,
  isEdit = false
}: CustomQuestionFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Initialize the form with default values or existing question data
  const form = useForm<QuestionFormValues>({
    resolver: zodResolver(questionFormSchema),
    defaultValues: existingQuestion ? {
      ...existingQuestion,
      options: existingQuestion.options ? 
        (typeof existingQuestion.options === 'string' ? 
          existingQuestion.options : 
          JSON.stringify(existingQuestion.options)
        ) : '',
      appointmentTypeId: appointmentTypeId
    } : {
      label: '',
      fieldKey: '',
      fieldType: 'TEXT',
      required: false,
      included: true,
      options: '',
      orderPosition: 1,
      appointmentTypeId: appointmentTypeId
    }
  });
  
  // Get the selected field type to conditionally render options input
  const selectedFieldType = form.watch('fieldType');
  const showOptionsField = ['SELECT', 'RADIO', 'CHECKBOX'].includes(selectedFieldType);
  
  // Function to handle form submission
  const onSubmit = async (data: QuestionFormValues) => {
    try {
      setIsSubmitting(true);
      
      // Process options if provided
      if (data.options && showOptionsField) {
        try {
          // Handle options as a comma-separated string
          const optionsArray = data.options.split(',').map((opt: any) => opt.trim()).filter((opt: any) => opt);
          data.options = JSON.stringify(optionsArray);
        } catch (error) {
          console.error('Error processing options:', error);
          toast({
            title: 'Error',
            description: 'Invalid options format. Please use comma-separated values.',
            variant: 'destructive'
          });
          setIsSubmitting(false);
          return;
        }
      } else if (showOptionsField && !data.options) {
        toast({
          title: 'Error',
          description: 'Options are required for this field type.',
          variant: 'destructive'
        });
        setIsSubmitting(false);
        return;
      }
      
      // If not showing options field, ensure options is set to empty
      if (!showOptionsField) {
        data.options = '';
      }
      
      // Call the save function from props
      onSave(data);
      
      // Reset form and close dialog
      form.reset();
      onClose();
    } catch (error) {
      console.error('Error saving question:', error);
      toast({
        title: 'Error',
        description: 'Failed to save question. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={(open: any) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Question' : 'Add Custom Question'}</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="label"
              render={({
                field
              }: any) => (
                <FormItem>
                  <FormLabel>Question Label</FormLabel>
                  <FormControl>
                    <Input placeholder="E.g., Trailer Number" {...field} />
                  </FormControl>
                  <FormDescription>
                    This is the label that will be displayed to users.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="fieldKey"
              render={({
                field
              }: any) => (
                <FormItem>
                  <FormLabel>Field Key</FormLabel>
                  <FormControl>
                    <Input placeholder="E.g., trailerNumber" {...field} />
                  </FormControl>
                  <FormDescription>
                    A unique identifier for this field (letters, numbers, underscores only).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="fieldType"
              render={({
                field
              }: any) => (
                <FormItem>
                  <FormLabel>Field Type</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select field type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="TEXT">Text Input</SelectItem>
                      <SelectItem value="TEXTAREA">Multi-line Text</SelectItem>
                      <SelectItem value="SELECT">Dropdown</SelectItem>
                      <SelectItem value="RADIO">Radio Buttons</SelectItem>
                      <SelectItem value="CHECKBOX">Checkboxes</SelectItem>
                      <SelectItem value="NUMBER">Number</SelectItem>
                      <SelectItem value="EMAIL">Email</SelectItem>
                      <SelectItem value="PHONE">Phone</SelectItem>
                      <SelectItem value="DATE">Date</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    The type of input field to display.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {showOptionsField && (
              <FormField
                control={form.control}
                name="options"
                render={({
                  field
                }: any) => (
                  <FormItem>
                    <FormLabel>Options</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter options separated by commas. E.g., Option 1, Option 2, Option 3" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      For dropdown, radio buttons, or checkboxes. Enter options separated by commas.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            <FormField
              control={form.control}
              name="orderPosition"
              render={({
                field
              }: any) => (
                <FormItem>
                  <FormLabel>Display Order</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      min="1" 
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                    />
                  </FormControl>
                  <FormDescription>
                    The order in which this question appears in the form.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex space-x-4">
              <FormField
                control={form.control}
                name="required"
                render={({
                  field
                }: any) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Required</FormLabel>
                      <FormDescription>
                        Make this question mandatory
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="included"
                render={({
                  field
                }: any) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Included</FormLabel>
                      <FormDescription>
                        Show this question in forms
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? 'Update' : 'Add'} Question
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}