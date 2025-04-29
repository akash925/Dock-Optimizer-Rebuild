import React from "react";
import { Link } from "wouter";
import { ChevronLeft, Users, LayoutDashboard, Building2, Settings } from "lucide-react";
import TopNav from "./top-nav";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
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
          
          <Link href="/admin" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-neutral-100 hover:text-primary">
            <LayoutDashboard className="h-4 w-4" />
            <span>Dashboard</span>
          </Link>
          
          <Link href="/admin/organizations" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-neutral-100 hover:text-primary">
            <Building2 className="h-4 w-4" />
            <span>Organizations</span>
          </Link>
          
          <Link href="/admin/users" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-neutral-100 hover:text-primary">
            <Users className="h-4 w-4" />
            <span>Users</span>
          </Link>
          
          <Link href="/admin/settings" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-neutral-100 hover:text-primary">
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </Link>
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        <TopNav />
        <main className="flex-1 p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}