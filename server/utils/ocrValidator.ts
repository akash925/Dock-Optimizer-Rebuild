import { z } from 'zod';

/**
 * Zod schema for validating OCR results
 * This schema defines the expected structure and data types for BOL OCR results
 */
export const ocrResultSchema = z.object({
  success: z.boolean(),
  processingTime: z.number().optional(),
  engineVersion: z.string().optional(),
  confidenceScore: z.number().min(0).max(100).optional(),
  ocrText: z.string().optional(),
  detectedFields: z.object({
    bolNumber: z.string().optional(),
    mcNumber: z.string().optional(),
    customerName: z.string().optional(),
    carrierName: z.string().optional(),
    trailerNumber: z.string().optional(),
    weight: z.string().optional(),
    palletCount: z.string().optional(),
    fromAddress: z.string().optional(),
    toAddress: z.string().optional(),
    pickupOrDropoff: z.enum(['pickup', 'dropoff']).optional(),
    notes: z.string().optional(),
  }).optional(),
  metadata: z.object({
    fileName: z.string().optional(),
    fileSize: z.number().optional(),
    mimeType: z.string().optional(),
    originalName: z.string().optional(),
    fileId: z.string().optional(),
  }).optional(),
  error: z.string().optional(),
  errorType: z.string().optional(),
});

// Function to validate OCR results against the schema
export function validateOcrResult(data: unknown) {
  try {
    const validatedData = ocrResultSchema.parse(data);
    return {
      isValid: true,
      data: validatedData,
      errors: null
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isValid: false,
        data: null,
        errors: error.format()
      };
    }
    
    // Handle unexpected errors
    return {
      isValid: false,
      data: null,
      errors: { _errors: [`Validation failed with error: ${error}`] }
    };
  }
}

// Type for validated OCR results
export type ValidatedOcrResult = z.infer<typeof ocrResultSchema>;