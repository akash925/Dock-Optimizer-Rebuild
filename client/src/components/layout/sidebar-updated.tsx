import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useOrg } from "@/hooks/useOrg";
import { useMemo } from "react";
import { Home, Menu, HelpCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { useMediaQuery } from "@/hooks/use-mobile";
import dockOptimizerLogo from "@/assets/dock_optimizer_logo.jpg";
import { navItems as defaultNavItems, managementItems as defaultManagementItems } from "./navConfig";

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
  const { enabledModules = [] } = useOrg();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [isSidebarOpen, setIsSidebarOpen] = useState(!isMobile);
  
  // Log enabled modules for debugging
  console.log("Sidebar: enabledModules:", enabledModules);
  
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
  
  // Filter navigation items based on enabled modules
  const filteredNavItems = defaultNavItems.filter(item => {
    // Dashboard is always visible
    if (item.key === 'dashboard') return true;
    
    // Check if the module is enabled for this organization
    return enabledModules.includes(item.key);
  });
  
  // Filter management items based on user role and enabled modules
  const filteredManagementItems = defaultManagementItems.filter(item => {
    // Check role requirements
    const hasRequiredRole = !item.roles || item.roles.includes(user.role);
    
    // Settings and other non-module-specific items are always visible if role permits
    if (item.key === 'settings') return hasRequiredRole;
    
    // Check if module is enabled for this organization
    return hasRequiredRole && enabledModules.includes(item.key);
  });

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
        
        {/* Display filtered navigation items */}
        {filteredNavItems.map(item => {
          // Create the icon element using the icon component from the item
          const IconComponent = item.icon;
          const itemIcon = <IconComponent size={20} />;
          
          return (
            <SidebarItem 
              key={item.path}
              href={item.path} 
              icon={itemIcon} 
              label={item.label} 
              active={location === item.path || (item.path !== "/" && location.startsWith(item.path + "/"))}
              onClick={closeSidebar}
            />
          );
        })}
        
        {/* Management section for admin/manager users */}
        {(user.role === "admin" || user.role === "manager") && filteredManagementItems.length > 0 && (
          <>
            <div className="px-4 py-2 mt-6 mb-2 text-neutral-400 text-xs font-medium uppercase">
              Management
            </div>
            
            {filteredManagementItems.map(item => {
              // Create the icon element using the icon component from the item
              const IconComponent = item.icon;
              const itemIcon = <IconComponent size={20} />;
              
              return (
                <SidebarItem 
                  key={item.path}
                  href={item.path} 
                  icon={itemIcon}
                  label={item.label} 
                  active={location === item.path}
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