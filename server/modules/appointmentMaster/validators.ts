import { z } from 'zod';
import { snakeToCamel } from '../../../shared/utils/object-mapper';

// Base schema for appointment type questions with database structure (snake_case)
const AppointmentTypeQuestionDbSchema = z.object({
  id: z.number(),
  label: z.string(),
  type: z.string(),
  is_required: z.boolean(),
  placeholder: z.string().optional(),
  options: z.string().optional(), // JSON string
  order_position: z.number(),
  appointment_type_id: z.number(),
  applicable_type: z.string().optional(),
  created_at: z.date().optional(),
  last_modified_at: z.date().optional(),
});

// Schema for appointment type questions with frontend structure (camelCase)
export const AppointmentTypeQuestionSchema = AppointmentTypeQuestionDbSchema.transform(snakeToCamel);

// Schema for creating/updating appointment type questions
export const CreateAppointmentTypeQuestionSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  type: z.string().min(1, 'Type is required'),
  isRequired: z.boolean().default(false),
  placeholder: z.string().optional(),
  options: z.string().optional(), // JSON string
  orderPosition: z.number(),
  appointmentTypeId: z.number(),
  applicableType: z.string().optional(),
});

// Schema for appointment type questions array
export const AppointmentTypeQuestionsArraySchema = z.array(AppointmentTypeQuestionSchema);

// Types inferred from schemas
export type AppointmentTypeQuestion = z.infer<typeof AppointmentTypeQuestionSchema>;
export type CreateAppointmentTypeQuestion = z.infer<typeof CreateAppointmentTypeQuestionSchema>;
export type AppointmentTypeQuestions = z.infer<typeof AppointmentTypeQuestionsArraySchema>;

// Validation function for appointment type questions
export function validateAppointmentTypeQuestion(data: unknown): AppointmentTypeQuestion {
  return AppointmentTypeQuestionSchema.parse(data);
}

// Validation function for creating appointment type questions
export function validateCreateAppointmentTypeQuestion(data: unknown): CreateAppointmentTypeQuestion {
  return CreateAppointmentTypeQuestionSchema.parse(data);
}

// Validation function for appointment type questions array
export function validateAppointmentTypeQuestionsArray(data: unknown): AppointmentTypeQuestions {
  return AppointmentTypeQuestionsArraySchema.parse(data);
} 