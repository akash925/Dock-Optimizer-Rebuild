import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { 
  LayoutDashboard,
  Users,
  Building2,
  Settings,
  LogOut
} from "lucide-react";

export function AdminHeader() {
  const { user, logoutMutation } = useAuth();
  
  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <header className="border-b bg-background">
      <div className="container mx-auto py-4 px-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/admin">
            <h1 className="text-xl font-bold">Dock Optimizer Admin</h1>
          </Link>
        </div>
        
        <nav className="flex-1 px-8">
          <ul className="flex gap-6">
            <li>
              <Link href="/admin">
                <Button variant="ghost" className="flex items-center gap-2">
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </Button>
              </Link>
            </li>
            <li>
              <Link href="/admin/organizations">
                <Button variant="ghost" className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Organizations
                </Button>
              </Link>
            </li>
            <li>
              <Link href="/admin/users">
                <Button variant="ghost" className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Users
                </Button>
              </Link>
            </li>
            <li>
              <Link href="/admin/settings">
                <Button variant="ghost" className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Settings
                </Button>
              </Link>
            </li>
          </ul>
        </nav>
        
        <div className="flex items-center gap-2">
          {user && (
            <div className="mr-4 text-sm">
              <span className="font-medium">{user.firstName} {user.lastName}</span>
              <span className="text-muted-foreground ml-2">({user.role})</span>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={handleLogout} className="flex items-center gap-2">
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
}

export default AdminHeader;