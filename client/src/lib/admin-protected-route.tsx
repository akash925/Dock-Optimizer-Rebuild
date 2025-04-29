import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";
import { Role } from "@shared/schema";
import AdminLayout from "@/components/layout/admin-layout";

interface AdminProtectedRouteProps {
  path: string;
  component: () => React.JSX.Element;
}

export function AdminProtectedRoute({
  path,
  component: Component,
}: AdminProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Route>
    );
  }

  if (!user) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  // Only super-admins can access admin routes
  if (user.role !== 'super-admin') {
    return (
      <Route path={path}>
        <div className="flex flex-col items-center justify-center p-8">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-4">
            You don't have permission to access this page.
          </p>
        </div>
      </Route>
    );
  }

  // Render the admin page without the standard layout
  return (
    <Route path={path}>
      <Component />
    </Route>
  );
}