// Type-safe API helpers
export const API_ENDPOINTS = {
  HEALTH: '/api/health',
} as const;

export type ApiEndpoint = typeof API_ENDPOINTS[keyof typeof API_ENDPOINTS]; 