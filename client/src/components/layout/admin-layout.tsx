import React from "react";
import { Link, useLocation } from "wouter";
import { ChevronLeft, Users, LayoutDashboard, Building2, Settings, BarChart3, Calendar } from "lucide-react";
import AdminTopNav from "./admin-top-nav";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [location] = useLocation();
  
  return (
    <div className="flex min-h-screen bg-neutral-100">
      <div className="w-64 bg-white border-r border-neutral-200 p-4">
        <div className="mb-6">
          <Link href="/" className="flex items-center gap-2 text-primary hover:text-primary/90">
            <ChevronLeft className="h-4 w-4" />
            <span>Back to App</span>
          </Link>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-gray-500 font-semibold uppercase mb-2">Admin Panel</p>
          
          <Link
            to="/admin"
            className={`flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              location === "/admin"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            <span>Dashboard</span>
          </Link>
          
          <Link
            to="/admin/orgs"
            className={`flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              location.startsWith("/admin/orgs")
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Building2 className="h-4 w-4" />
            <span>Organizations</span>
          </Link>
          
          <Link
            to="/admin/users"
            className={`flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              location.startsWith("/admin/users")
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Users</span>
          </Link>

          <Link
            to="/admin/appointments"
            className={`flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              location.startsWith("/admin/appointments")
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span>Appointments</span>
          </Link>
          
          <Link
            to="/admin/settings"
            className={`flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              location.startsWith("/admin/settings")
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </Link>
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        <AdminTopNav />
        <main className="flex-1 p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}