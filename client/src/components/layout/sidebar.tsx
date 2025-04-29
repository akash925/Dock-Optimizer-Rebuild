import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useModules } from "@/contexts/ModuleContext"; 
import { useMemo } from "react";
import {
  BarChart3,
  Calendar,
  CalendarRange,
  DoorOpen,
  HelpCircle,
  Home,
  Settings,
  TruckIcon,
  Users,
  Menu,
  Layout,
  ClipboardList,
  Warehouse,
  FileText,
  Globe,
  File,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useMediaQuery } from "@/hooks/use-mobile";
import dockOptimizerLogo from "@/assets/dock_optimizer_logo.jpg";

interface SidebarProps {
  className?: string;
}

interface SidebarItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({
  href,
  icon,
  label,
  active,
  onClick,
}) => {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center px-4 py-3 text-neutral-400 hover:bg-neutral-100 transition-colors",
        active && "text-primary bg-opacity-10 border-l-4 border-primary sidebar-active"
      )}
    >
      <span className="mr-3">{icon}</span>
      {label}
    </Link>
  );
};

export default function Sidebar({ className }: SidebarProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const { isModuleEnabled } = useModules();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [isSidebarOpen, setIsSidebarOpen] = useState(!isMobile);
  
  useEffect(() => {
    setIsSidebarOpen(!isMobile);
  }, [isMobile]);

  // Early return if not authenticated
  if (!user) return null;

  const closeSidebar = () => {
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };
  
  // Navigation links with their module dependencies
  const navItems = useMemo(() => [
    { href: "/", icon: <Home size={20} />, label: "Overview", module: null },
    { href: "/schedules", icon: <Calendar size={20} />, label: "Calendar", module: "calendar" },
    { href: "/door-manager", icon: <Layout size={20} />, label: "Door Manager", module: "doorManager" },
    { href: "/analytics", icon: <BarChart3 size={20} />, label: "Analytics", module: "analytics" },
    { href: "/appointments", icon: <ClipboardList size={20} />, label: "Appointments", module: "appointments" },
    { href: "/asset-manager", icon: <File size={20} />, label: "Asset Manager", module: "assetManager" },
  ], []);
  
  // Management links with their module dependencies
  const managementItems = useMemo(() => [
    { href: "/facility-master", icon: <Warehouse size={20} />, label: "Facility Master", module: "facilityManagement", roles: ["admin", "manager"] },
    { href: "/appointment-master", icon: <FileText size={20} />, label: "Appointment Master", module: "appointments", roles: ["admin", "manager"] },
    { href: "/booking-pages", icon: <Globe size={20} />, label: "Booking Pages", module: "bookingPages", roles: ["admin", "manager"] },
    { href: "/users", icon: <Users size={20} />, label: "Users", module: "userManagement", roles: ["admin"] },
    { href: "/settings", icon: <Settings size={20} />, label: "Settings", module: null, roles: ["admin", "manager"] },
    { href: "#", icon: <HelpCircle size={20} />, label: "Help", module: null, roles: ["admin", "manager"] },
  ], []);

  const sidebarContent = (
    <div 
      className={cn(
        "bg-white shadow-md h-full transition-all duration-300",
        isMobile ? (
          isSidebarOpen 
            ? "fixed inset-y-0 left-0 z-50 w-64" 
            : "hidden"
        ) : "w-64",
        className
      )}
    >
      <div className="p-4">
        <div className="flex items-center">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <img 
                src={dockOptimizerLogo} 
                alt="Dock Optimizer Logo" 
                className="h-10 mr-1"
              />
            </div>
          </Link>
        </div>
      </div>
      
      <div className="border-t border-neutral-100 py-4">
        <div className="px-4 py-2 mb-2 text-neutral-400 text-xs font-medium uppercase">
          Dashboard
        </div>
        
        {/* Filter navigation links based on module availability */}
        {navItems.map(item => 
          (!item.module || isModuleEnabled(item.module)) && (
            <SidebarItem 
              key={item.href}
              href={item.href} 
              icon={item.icon} 
              label={item.label} 
              active={location === item.href || (item.href !== "/" && location.startsWith(item.href + "/"))}
              onClick={closeSidebar}
            />
          )
        )}
        
        {/* Management section for admin/manager users */}
        {(user.role === "admin" || user.role === "manager") && (
          <>
            <div className="px-4 py-2 mt-6 mb-2 text-neutral-400 text-xs font-medium uppercase">
              Management
            </div>
            
            {/* Filter management links based on module availability and user role */}
            {managementItems.map(item => {
              // Check if user has required role
              const hasRequiredRole = !item.roles || item.roles.includes(user.role);
              
              // Check if module is enabled or no module required
              const isEnabled = !item.module || isModuleEnabled(item.module);
              
              // Only render if user has required role and module is enabled
              return (hasRequiredRole && isEnabled) && (
                <SidebarItem 
                  key={item.href}
                  href={item.href} 
                  icon={item.icon} 
                  label={item.label} 
                  active={location === item.href}
                  onClick={closeSidebar}
                />
              );
            })}
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      {isMobile && (
        <button 
          onClick={toggleSidebar}
          className="fixed bottom-4 right-4 bg-primary text-white p-3 rounded-full shadow-lg z-50 md:hidden"
        >
          <Menu size={24} />
        </button>
      )}
      {sidebarContent}
    </>
  );
}
