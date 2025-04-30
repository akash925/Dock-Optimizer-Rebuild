import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useModules } from "@/contexts/ModuleContext";
import { useOrg } from "@/hooks/useOrg";
import { useMemo } from "react";
import { Menu } from "lucide-react";
import { navItems, managementItems } from "./navConfig";
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
  const { enabledModules = [] } = useOrg();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [isSidebarOpen, setIsSidebarOpen] = useState(!isMobile);
  
  // Log enabled modules for debugging
  useEffect(() => {
    console.log('Sidebar: useOrg enabled modules:', enabledModules);
  }, [enabledModules]);
  
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
  
  // Convert navConfig items to internal format
  const navItemsInternal = useMemo(() => 
    navItems.map(item => ({
      href: item.path,
      icon: <item.icon size={20} />,
      label: item.label,
      module: item.key !== 'dashboard' ? item.key : null
    }))
  , []);
  
  // Convert management items to internal format
  const managementItemsInternal = useMemo(() => 
    managementItems.map(item => ({
      href: item.path,
      icon: <item.icon size={20} />,
      label: item.label,
      module: item.key !== 'settings' ? item.key : null,
      roles: item.roles || []
    }))
  , []);

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
        
        {/* Filter navigation links based on module availability - using both ModuleContext and useOrg */}
        {navItemsInternal.map(item => {
          // Dashboard (home) and non-module items are always shown
          if (!item.module || item.module === null) {
            return (
              <SidebarItem 
                key={item.href}
                href={item.href} 
                icon={item.icon} 
                label={item.label} 
                active={location === item.href || (item.href !== "/" && location.startsWith(item.href + "/"))}
                onClick={closeSidebar}
              />
            );
          }
          
          // For module-dependent items, check both contexts
          // Either the ModuleContext enables it OR useOrg's enabledModules includes it
          const isEnabled = isModuleEnabled(item.module) || enabledModules.includes(item.module);
          
          if (isEnabled) {
            return (
              <SidebarItem 
                key={item.href}
                href={item.href} 
                icon={item.icon} 
                label={item.label} 
                active={location === item.href || (item.href !== "/" && location.startsWith(item.href + "/"))}
                onClick={closeSidebar}
              />
            );
          }
          
          return null;
        })}
        
        {/* Management section for admin/manager users */}
        {(user.role === "admin" || user.role === "manager") && (
          <>
            <div className="px-4 py-2 mt-6 mb-2 text-neutral-400 text-xs font-medium uppercase">
              Management
            </div>
            
            {/* Filter management links based on module availability and user role */}
            {managementItemsInternal.map(item => {
              // Check if user has required role
              const hasRequiredRole = !item.roles || item.roles.includes(user.role);
              
              // Settings and other role-only items (no module dependency)
              if (!item.module || item.module === null) {
                return hasRequiredRole && (
                  <SidebarItem 
                    key={item.href}
                    href={item.href} 
                    icon={item.icon} 
                    label={item.label} 
                    active={location === item.href}
                    onClick={closeSidebar}
                  />
                );
              }
              
              // Check both contexts - either ModuleContext OR useOrg's enabledModules
              const isEnabled = isModuleEnabled(item.module) || enabledModules.includes(item.module);
              
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
