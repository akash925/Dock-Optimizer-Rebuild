import React from 'react';
import { useLocation, useRoute, Link as WouterLink } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  Building2, 
  Users, 
  PuzzleIcon, 
  ArrowLeftIcon,
  HomeIcon,
  Settings,
} from 'lucide-react';
import { OrganizationsList } from '@/components/admin/organizations-list';
import { AdminHeader } from '@/components/admin/admin-header';

const AdminDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [isRoot] = useRoute('/admin');
  
  // Redirect non-admin users
  React.useEffect(() => {
    if (user && user.role !== 'super-admin' && user.role !== 'admin') {
      toast({
        title: 'Access Denied',
        description: 'You do not have permission to access this area.',
        variant: 'destructive',
      });
      setLocation('/');
    }
  }, [user, setLocation, toast]);

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container px-4 py-6 mx-auto max-w-7xl">
      <AdminHeader />
      
      <Tabs defaultValue="organizations" className="mt-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto">
          <TabsTrigger value="organizations" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Organizations
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="modules" className="flex items-center gap-2">
            <PuzzleIcon className="w-4 h-4" />
            Modules
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="organizations" className="p-4 mt-6 border rounded-md">
          <OrganizationsList />
        </TabsContent>
        
        <TabsContent value="users" className="p-4 mt-6 border rounded-md">
          <h2 className="mb-4 text-2xl font-bold">Global Users</h2>
          <p className="text-gray-500">Manage all user accounts across organizations.</p>
          <div className="flex items-center justify-center p-20 text-gray-400">
            User management will be implemented soon.
          </div>
        </TabsContent>
        
        <TabsContent value="modules" className="p-4 mt-6 border rounded-md">
          <h2 className="mb-4 text-2xl font-bold">System Modules</h2>
          <p className="text-gray-500">View and manage system-wide module configurations.</p>
          <div className="flex items-center justify-center p-20 text-gray-400">
            Module management will be implemented soon.
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDashboard;