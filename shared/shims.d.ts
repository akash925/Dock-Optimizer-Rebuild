// Type shims for missing database fields and method signatures
// This file provides type extensions without modifying the core schema

declare module './utils/logger' {
  interface Logger {
    debug(message: string, meta?: any): void;
  }
}

// Extend existing types with missing properties
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        role: string;
        username: string;
        tenantId: number | null;
        email: string;
        firstName: string;
        lastName: string;
        modules?: string[];
      };
    }
  }
  
  // Database query result null safety
  interface PgResult {
    rowCount: number | null;
  }
}

// Database schema extensions (read-only augmentations)
declare module '@shared/schema' {
  // Base type definitions (replacing the ones commented out in schema.ts)
  type Schedule = {
    id: number;
    createdAt: Date;
    type: string;
    status: string;
    createdBy: number | null;
    tenantId: number | null;
    lastModifiedAt: Date | null;
    facilityId: number | null;
    mcNumber: string | null;
    carrierName: string | null;
    startTime: Date;
    endTime: Date;
    [key: string]: any;
  } & {
    lastModifiedBy?: number | null;
  };
  
  type DefaultHours = {
    id: number;
    createdAt: Date;
    updatedAt: Date | null;
    tenantId: number | null;
    organizationId: number;
    dayOfWeek: number;
    startTime: string | null;
    endTime: string | null;
    breakStart: string | null;
    breakEnd: string | null;
  } & {
    isOpen?: boolean;
    openTime?: string;
    closeTime?: string;
    updatedAt?: Date | null;
  };
  
  type UserPreferences = {
    id: number;
    createdAt: Date;
    updatedAt: Date | null;
    userId: number;
    organizationId: number;
    emailNotificationsEnabled: boolean;
  } & {
    pushNotificationsEnabled?: boolean;
  };
  
  type User = {
    id: number;
    email: string;
    username: string;
    password: string;
    firstName: string;
    lastName: string;
    role: string;
    createdAt: Date;
    tenantId: number | null;
  } & {
    modules?: string | string[];
  };
}

// Storage interface extensions
declare module 'server/storage' {
  interface IStorage {
    getSystemSettings?(): Promise<any>;
    updateSystemSettings?(settings: any): Promise<any>;
    getDock?(dockId: number): Promise<any>;
    getCarrier?(carrierId: number): Promise<any>;
    getCarriers?(): Promise<any[]>;
    saveStandardQuestionsForAppointmentType?(typeId: number, questions: any[]): Promise<any>;
    getStandardQuestions?(): Promise<any[]>;
    createStandardQuestionWithId?(question: any): Promise<any>;
    updateUserPreferences?(userId: number, organizationId: number, preferences: any): Promise<any>;
  }
}

// Vite config type safety
declare module 'vite' {
  interface ManualChunksOption {
    (id: string): string | void;
  }
}

// shared/shims.d.ts
// --------------------------------------------------
// existing declarations you already have …
// --------------------------------------------------

// extra loosening so vite & storage compile tonight
declare module "@shared/schema" {
  interface User {
    id?: number;
    role?: string;
    username?: string;
  }
  interface StoredFile {
    uploadedBy?: number;
    uploadedAt?: Date;
    description?: string;
    tags?: string[];
    photoUrl?: string;
  }
  interface EnhancedSchedule {
    lastModifiedBy?: number;
  }
  type insertAssetSchema = any;
  type updateCompanyAssetSchema = any;
}


export {};

