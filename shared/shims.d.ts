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
  interface Schedule {
    lastModifiedBy?: number | null;
  }
  
  interface DefaultHours {
    isOpen?: boolean;
    openTime?: string;
    closeTime?: string;
    breakStart?: string | null;
    breakEnd?: string | null;
    updatedAt?: Date | null;
  }
  
  interface UserPreferences {
    pushNotificationsEnabled?: boolean;
  }
  
  interface User {
    modules?: string | string[];
  }
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

export {};