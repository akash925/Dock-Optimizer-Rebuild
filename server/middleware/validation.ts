/**
 * Validation Middleware
 * 
 * Provides Zod-based validation middleware for API endpoints
 * to ensure data integrity and proper input validation.
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// Validate tenant belongs to user
export const checkTenant = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const userTenantId = req.user?.tenantId;
  const { tenantId } = req.body;

  // Super admins can access any tenant
  if (req.user?.role === 'super-admin' || req.user?.username?.includes('admin@conmitto.io')) {
    return next();
  }

  // If tenantId is specified in the request, make sure it matches the user's tenant
  if (tenantId && userTenantId && tenantId !== userTenantId) {
    console.log(`[TenantCheck] Tenant mismatch: User tenant ${userTenantId}, requested tenant ${tenantId}`);
    return res.status(403).json({ message: 'You do not have permission to access this resource' });
  }

  next();
};

// Authentication middleware
export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
};

// Role-based authorization middleware
export const checkRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userRole = req.user?.role;
    if (!userRole || !roles.includes(userRole)) {
      return res.status(403).json({ 
        message: 'You do not have permission to access this resource',
        required: roles,
        userRole
      });
    }

    next();
  };
};

// Schema for booking through external booking pages
export const bookAppointmentSchema = z.object({
  facilityId: z.coerce.number().positive({ message: "Facility ID is required" }),
  appointmentTypeId: z.coerce.number().positive({ message: "Appointment type ID is required" }),
  date: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: "Start time must be in format HH:MM" }),
  
  // Contact information
  contactName: z.string().min(1, { message: "Contact name is required" }),
  contactEmail: z.string().email({ message: "Valid email is required" }).optional(),
  contactPhone: z.string().optional(),
  
  // Additional fields with flexible validation
  carrierName: z.string().optional(),
  driverName: z.string().optional(),
  driverPhone: z.string().optional(),
  customerName: z.string().optional(),
  truckId: z.string().optional(),
  trailerNumber: z.string().optional(),
  referenceNumber: z.string().optional(),
  poNumber: z.string().optional(),
  notes: z.string().optional(),
  
  // Form data
  customFormData: z.union([z.string(), z.record(z.any())]).optional(),
});

// Schema for linking BOL documents to appointments
export const bolLinkSchema = z.object({
  appointmentId: z.number().positive({ message: "Appointment ID is required" }),
  bolDocumentId: z.number().positive({ message: "BOL document ID is required" })
});

// Schema for resending confirmation emails
export const resendEmailSchema = z.object({
  confirmationCode: z.string().min(1, { message: "Confirmation code is required" }),
  recipientEmail: z.string().email({ message: "Valid email is required" }),
});

// Middleware factory for Zod validation
export const validateWithZod = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request body against schema
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: 'Validation error',
          errors: error.errors
        });
      }
      
      // Handle other types of errors
      console.error('Validation error:', error);
      return res.status(500).json({ message: 'Server error during validation' });
    }
  };
};