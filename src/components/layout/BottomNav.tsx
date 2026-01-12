import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Receipt,
  FileText,
  Settings,
  Mic
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(location.pathname);

  // Sync state with location
  useEffect(() => {
    setActiveTab(location.pathname);
  }, [location.pathname]);

  const navItems = [
    { path: '/dashboard', label: 'Home', icon: LayoutDashboard },
    { path: '/quotes', label: 'Quotes', icon: FileText },
    { path: '/jobs', label: 'Jobs', icon: Briefcase },
    { path: '/invoices', label: 'Invoices', icon: Receipt },
    { path: '/clients', label: 'Clients', icon: Users },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up pb-safe-bottom">
      <div className="relative h-[80px] w-full max-w-lg mx-auto flex items-end mb-safe-bottom">

        {/* Glassmorphism Background Container */}
        <div className="absolute inset-x-4 bottom-4 h-[72px] bg-card/90 backdrop-blur-2xl border border-white/20 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.12)] rounded-[2.5rem] overflow-hidden">
          {/* Subtle internal gradient/shine */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent opacity-50 pointer-events-none" />
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-70" />
        </div>

        {/* Floating Action Button (FAB) - Centered & Floating */}
        <div className="absolute bottom-[28px] left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <div className="relative pointer-events-auto group animate-float">
            {/* Deep Glow/Shadow */}
            <div className="absolute inset-0 rounded-full bg-primary/40 blur-2xl animate-pulse-glow" />

            {/* Main Button */}
            <Button
              size="icon"
              className="relative w-16 h-16 rounded-full bg-primary hover:bg-primary-hover shadow-glow-lg transition-all duration-500 hover:scale-110 active:scale-90 border-[4px] border-[#F5F5F5] dark:border-[#121212] group-hover:rotate-3"
              onClick={() => console.log("Voice FAB clicked")}
            >
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/20 to-transparent opacity-100" />
              <Mic className="w-7 h-7 text-primary-foreground drop-shadow-md transition-transform duration-500 group-hover:scale-110 group-active:scale-90" />
            </Button>
          </div>
        </div>

        {/* Nav Items Container */}
        <div className="absolute inset-x-4 bottom-4 h-[72px] flex items-center justify-between px-2 z-20">

          {/* Left Group */}
          <div className="flex items-center justify-between w-[42%] h-full pl-1">
            <NavItem
              item={navItems[0]}
              isActive={activeTab === navItems[0].path}
              onClick={() => navigate(navItems[0].path)}
            />
            <NavItem
              item={navItems[1]}
              isActive={activeTab.startsWith(navItems[1].path)}
              onClick={() => navigate(navItems[1].path)}
            />
            <NavItem
              item={navItems[2]}
              isActive={activeTab.startsWith(navItems[2].path)}
              onClick={() => navigate(navItems[2].path)}
            />
          </div>

          {/* Spacer for FAB */}
          <div className="w-16 shrink-0" />

          {/* Right Group */}
          <div className="flex items-center justify-between w-[42%] h-full pr-1">
            <NavItem
              item={navItems[3]}
              isActive={activeTab.startsWith(navItems[3].path)}
              onClick={() => navigate(navItems[3].path)}
            />
            <NavItem
              item={navItems[4]}
              isActive={activeTab.startsWith(navItems[4].path)}
              onClick={() => navigate(navItems[4].path)}
            />
            <NavItem
              item={navItems[5]}
              isActive={activeTab.startsWith(navItems[5].path)}
              onClick={() => navigate(navItems[5].path)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function NavItem({ item, isActive, onClick }: { item: any, isActive: boolean, onClick: () => void }) {
  const Icon = item.icon;
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isActive) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center justify-center h-12 w-12 rounded-2xl transition-all duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
        isActive ? "text-primary -translate-y-3" : "text-muted-foreground/60 hover:text-foreground active:scale-95"
      )}
    >
      {/* Active Indicator Background Pill */}
      {isActive && (
        <span className="absolute inset-0 bg-primary/10 rounded-2xl animate-scale-in border border-primary/5" />
      )}

      {/* Icon Wrapper for transforms */}
      <div className={cn(
        "relative z-10 p-2 transition-all duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
        isActive ? "scale-110" : "group-hover:scale-105"
      )}>
        <Icon
          className={cn(
            "w-6 h-6 transition-all duration-500",
            isActive && "fill-current drop-shadow-[0_2px_8px_rgba(var(--primary),0.3)]",
            isAnimating && "animate-wiggle"
          )}
          strokeWidth={isActive ? 2.5 : 2}
        />

        {/* Active Glow Dot */}
        {isActive && (
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full shadow-[0_0_8px_currentColor] animate-fade-in" />
        )}
      </div>

      {/* Label - fades in/out on selection */}
      <span className={cn(
        "absolute -bottom-5 text-[9px] font-bold tracking-tight transition-all duration-300 ease-out whitespace-nowrap",
        isActive
          ? "opacity-100 translate-y-0 text-primary"
          : "opacity-0 -translate-y-2 pointer-events-none"
      )}>
        {item.label}
      </span>
    </button>
  );
}