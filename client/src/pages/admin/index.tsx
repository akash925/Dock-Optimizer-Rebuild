import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import AdminLayout from "@/components/layout/admin-layout";

// Stats interface
interface AdminStats {
  organizationsCount: number;
  usersCount: number;
  modulesCount: number;
  lastUpdated: string;
}

export default function AdminDashboard() {
  // Fetch admin stats
  const { data: stats, isLoading, error } = useQuery<AdminStats>({
    queryKey: ['/api/admin/stats'],
  });

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="p-6">
          <h2 className="text-2xl font-semibold tracking-tight mb-6">Admin Dashboard</h2>
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="text-red-600">Failed to load stats: {error.message}</div>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6">
        <h2 className="text-2xl font-semibold tracking-tight mb-6">Admin Dashboard</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Organizations</CardTitle>
              <CardDescription>Total tenant organizations</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">{stats?.organizationsCount || 0}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Users</CardTitle>
              <CardDescription>Total users across the platform</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">{stats?.usersCount || 0}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Modules</CardTitle>
              <CardDescription>Available feature modules</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">{stats?.modulesCount || 0}</p>
            </CardContent>
          </Card>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>System Overview</CardTitle>
            <CardDescription>
              Global administration platform for managing tenant organizations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p>
                Welcome to the Dock Optimizer Admin Dashboard. Use the navigation on the
                left to manage organizations, users, and system settings.
              </p>
              
              <p className="text-sm text-muted-foreground">
                Last updated: {stats?.lastUpdated ? new Date(stats.lastUpdated).toLocaleString() : 'Unknown'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}