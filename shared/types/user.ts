export interface User {
  id: number;
  username: string;
  email: string;
  role: "admin" | "user" | "viewer" | string;
  tenantId: number | null;
  firstName?: string;
  lastName?: string;
  modules?: string[];
  // add optional fields here as they crop up
} 