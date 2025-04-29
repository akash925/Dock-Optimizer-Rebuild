import React from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { ArrowLeftIcon, HomeIcon } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

const AdminHeader = () => {
  const { user } = useAuth();
  
  return (
    <div className="flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Console</h1>
          <p className="text-gray-500">Manage organizations, users and modules</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" asChild>
            <Link href="/" className="flex items-center gap-2">
              <HomeIcon className="w-4 h-4" />
              Dashboard
            </Link>
          </Button>
        </div>
      </div>
      
      <div className="flex items-center gap-2 p-3 text-sm bg-blue-50 text-blue-700 rounded-md">
        <span className="font-semibold">Logged in as:</span> 
        <span className="px-2 py-1 bg-blue-100 rounded-md">{user?.username} ({user?.role})</span>
      </div>
    </div>
  );
};

export default AdminHeader;