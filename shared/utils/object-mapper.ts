/**
 * Object mapper utilities for transforming between camelCase and snake_case
 */

// Helper function to convert camelCase to snake_case
function camelToSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

// Helper function to convert snake_case to camelCase
function snakeToCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Recursively transforms object keys from camelCase to snake_case
 */
export function camelToSnake<T extends Record<string, any>>(obj: T): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => camelToSnake(item));
  }

  if (typeof obj === 'object' && obj.constructor === Object) {
    const result: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const snakeKey = camelToSnakeCase(key);
      
      if (value && typeof value === 'object') {
        result[snakeKey] = camelToSnake(value);
      } else {
        result[snakeKey] = value;
      }
    }
    
    return result;
  }

  return obj;
}

/**
 * Recursively transforms object keys from snake_case to camelCase
 */
export function snakeToCamel<T extends Record<string, any>>(obj: T): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => snakeToCamel(item));
  }

  if (typeof obj === 'object' && obj.constructor === Object) {
    const result: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = snakeToCamelCase(key);
      
      if (value && typeof value === 'object') {
        result[camelKey] = snakeToCamel(value);
      } else {
        result[camelKey] = value;
      }
    }
    
    return result;
  }

  return obj;
}

// Type-safe helper for database to frontend transformations
export function transformDbToFrontend<T>(obj: T): any {
  return snakeToCamel(obj as any);
}

// Type-safe helper for frontend to database transformations  
export function transformFrontendToDb<T>(obj: T): any {
  return camelToSnake(obj as any);
} 