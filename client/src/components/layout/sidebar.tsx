import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
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
        <SidebarItem 
          href="/" 
          icon={<Home size={20} />} 
          label="Overview" 
          active={location === "/"} 
          onClick={closeSidebar}
        />
        <SidebarItem 
          href="/schedules" 
          icon={<Calendar size={20} />} 
          label="Calendar" 
          active={location === "/schedules" || location.startsWith("/schedules/")}
          onClick={closeSidebar}
        />
        
        <SidebarItem 
          href="/door-manager" 
          icon={<Layout size={20} />} 
          label="Door Manager" 
          active={location === "/door-manager"}
          onClick={closeSidebar}
        />
        <SidebarItem 
          href="/analytics" 
          icon={<BarChart3 size={20} />} 
          label="Analytics" 
          active={location === "/analytics"}
          onClick={closeSidebar}
        />
        
        <SidebarItem 
          href="/appointments" 
          icon={<ClipboardList size={20} />} 
          label="Appointments" 
          active={location === "/appointments"}
          onClick={closeSidebar}
        />
        
        <SidebarItem 
          href="/asset-manager" 
          icon={<File size={20} />} 
          label="Asset Manager" 
          active={location === "/asset-manager"}
          onClick={closeSidebar}
        />
        
        {(user.role === "admin" || user.role === "manager") && (
          <>
            <div className="px-4 py-2 mt-6 mb-2 text-neutral-400 text-xs font-medium uppercase">
              Management
            </div>
            <SidebarItem 
              href="/facility-master" 
              icon={<Warehouse size={20} />} 
              label="Facility Master" 
              active={location === "/facility-master"}
              onClick={closeSidebar}
            />
            <SidebarItem 
              href="/appointment-master" 
              icon={<FileText size={20} />} 
              label="Appointment Master" 
              active={location === "/appointment-master"}
              onClick={closeSidebar}
            />
            <SidebarItem 
              href="/booking-pages" 
              icon={<Globe size={20} />} 
              label="Booking Pages" 
              active={location === "/booking-pages"}
              onClick={closeSidebar}
            />
            {user.role === "admin" && (
              <SidebarItem 
                href="/users" 
                icon={<Users size={20} />} 
                label="Users" 
                active={location === "/users"}
                onClick={closeSidebar}
              />
            )}
            <SidebarItem 
              href="/settings" 
              icon={<Settings size={20} />} 
              label="Settings" 
              active={location === "/settings"}
              onClick={closeSidebar}
            />
            <SidebarItem 
              href="#" 
              icon={<HelpCircle size={20} />} 
              label="Help" 
              active={location === "/help"}
              onClick={closeSidebar}
            />
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
