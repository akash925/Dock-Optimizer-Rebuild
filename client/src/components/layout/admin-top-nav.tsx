import { useAuth } from "@/hooks/use-auth";
import { LogOut, ChevronDown, Building, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function AdminTopNav() {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();

  if (!user) return null;

  const handleLogout = () => {
    logoutMutation.mutate();
  };
  
  const isActive = (path: string) => {
    return location.startsWith(path);
  };

  return (
    <header className="bg-white shadow-sm h-16 flex items-center justify-between px-4 sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <Link href="/admin">
          <h1 className="font-semibold text-lg cursor-pointer">Dock Optimizer Admin Console</h1>
        </Link>
      </div>
      
      <div className="flex-1 flex items-center justify-center gap-6">
        <Link href="/admin/organizations">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${isActive('/admin/organizations') ? 'bg-neutral-100 text-primary' : 'hover:bg-neutral-50'}`}>
            <Building className="h-4 w-4" />
            <span className="text-sm font-medium">Organizations</span>
          </div>
        </Link>
        <Link href="/admin/users">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${isActive('/admin/users') ? 'bg-neutral-100 text-primary' : 'hover:bg-neutral-50'}`}>
            <Users className="h-4 w-4" />
            <span className="text-sm font-medium">Users</span>
          </div>
        </Link>
      </div>
      
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {user.firstName} {user.lastName}
              </span>
              <ChevronDown className="h-4 w-4 text-neutral-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <div className="px-3 py-2">
              <div className="text-sm font-medium">{user.firstName} {user.lastName}</div>
              <div className="text-xs text-neutral-500">{user.email}</div>
              <div className="text-xs text-neutral-400 mt-1 capitalize">{user.role} role</div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-500">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}