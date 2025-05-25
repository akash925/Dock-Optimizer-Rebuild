import { createContext, ReactNode, useContext, useMemo } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { insertUserSchema, type User, type InsertUser } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AuthContextType = {
  user: Omit<User, "password"> | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<Omit<User, "password">, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<Omit<User, "password">, Error, InsertUser>;
};

type LoginData = Pick<InsertUser, "username" | "password">;

// Helper function to determine if we're on a public route
// Extracted to avoid duplicating logic
function isPublicRoute(): boolean {
  const path = window.location.pathname;
  return path.startsWith('/external/') || 
         path.startsWith('/booking-confirmation') || 
         path.startsWith('/driver-check-in') ||
         path.startsWith('/auth');
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  
  // Use the isPublicRoute function to determine if we should skip auth
  const skipAuth = isPublicRoute();
  
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<Omit<User, "password"> | undefined, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    // Skip the authentication API call entirely for public routes
    enabled: !skipAuth,
    retry: false,
    // Don't refetch when window gets focus on public routes
    refetchOnWindowFocus: !skipAuth
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      try {
        const response = await fetch("/api/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify(credentials),
          credentials: "include",
        });
        
        // Check content type to ensure we received JSON
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          // Log the raw response for debugging
          const rawText = await response.text();
          console.error("Login response is not JSON:", contentType);
          console.error("Raw response (first 100 chars):", rawText.slice(0, 100));
          throw new Error("Server did not return a valid JSON response");
        }
        
        // Now parse as JSON since we've confirmed the content type
        let data;
        try {
          // Reset the response body stream
          const clonedResponse = response.clone();
          data = await clonedResponse.json();
        } catch (parseError) {
          console.error("JSON parsing error:", parseError);
          throw new Error("Failed to parse server response as JSON");
        }
        
        if (!response.ok) {
          throw new Error(data.message || "Login failed");
        }
        
        return data;
      } catch (error) {
        console.error("Login error:", error);
        throw error;
      }
    },
    onSuccess: (response: {success: boolean, user: Omit<User, "password">}) => {
      // Extract user from the response
      const user = response.user;
      
      // Update the cache with just the user data
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "Login successful",
        description: `Welcome back, ${user.firstName || "User"}!`,
      });
    },
    onError: (error: Error) => {
      console.error("Login mutation error:", error);
      toast({
        title: "Login failed",
        description: error.message || "An error occurred during login",
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: InsertUser) => {
      try {
        const response = await fetch("/api/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify(credentials),
          credentials: "include",
        });
        
        // Check content type to ensure we received JSON
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          // Log the raw response for debugging
          const rawText = await response.text();
          console.error("Registration response is not JSON:", contentType);
          console.error("Raw response (first 100 chars):", rawText.slice(0, 100));
          throw new Error("Server did not return a valid JSON response");
        }
        
        // Now parse as JSON since we've confirmed the content type
        let data;
        try {
          // Reset the response body stream
          const clonedResponse = response.clone();
          data = await clonedResponse.json();
        } catch (parseError) {
          console.error("JSON parsing error:", parseError);
          throw new Error("Failed to parse server response as JSON");
        }
        
        if (!response.ok) {
          throw new Error(data.message || "Registration failed");
        }
        
        return data;
      } catch (error) {
        console.error("Registration error:", error);
        throw error;
      }
    },
    onSuccess: (response: {success: boolean, user: Omit<User, "password">} | Omit<User, "password">) => {
      // Handle both response formats - either the user object directly or nested in a success response
      const user = 'user' in response ? response.user : response;
      
      // Update the cache with just the user data
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "Registration successful",
        description: `Welcome, ${user.firstName || "User"}!`,
      });
    },
    onError: (error: Error) => {
      console.error("Registration mutation error:", error);
      toast({
        title: "Registration failed",
        description: error.message || "An error occurred during registration",
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      try {
        const response = await fetch("/api/logout", {
          method: "POST",
          credentials: "include",
        });
        
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.message || "Logout failed");
        }
        
        return;
      } catch (error) {
        console.error("Logout error:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      toast({
        title: "Logout successful",
        description: "You have been logged out.",
      });
    },
    onError: (error: Error) => {
      console.error("Logout mutation error:", error);
      toast({
        title: "Logout failed",
        description: error.message || "An error occurred during logout",
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading: skipAuth ? false : isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  
  return context;
}
