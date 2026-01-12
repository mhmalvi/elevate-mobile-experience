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

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { path: '/dashboard', label: 'Home', icon: LayoutDashboard },
    { path: '/quotes', label: 'Quotes', icon: FileText },
    { path: '/jobs', label: 'Jobs', icon: Briefcase },
    { path: '/invoices', label: 'Invoices', icon: Receipt },
    { path: '/clients', label: 'Clients', icon: Users },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up">
      <div className="relative h-[72px] w-full max-w-lg mx-auto">
        {/* Glassmorphism Background */}
        <div className="absolute inset-x-0 bottom-0 h-[68px] bg-card/95 backdrop-blur-xl border-t border-border/50 shadow-[0_-8px_32px_rgba(0,0,0,0.12)]" />

        {/* Floating Action Button with Pulse Animation */}
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-20">
          {/* Outer glow ring */}
          <div className="absolute inset-0 w-[72px] h-[72px] -left-1 -top-1 bg-primary/30 rounded-full blur-xl animate-pulse" />
          <Button
            size="icon"
            className="relative w-[64px] h-[64px] rounded-full bg-gradient-to-br from-primary via-primary to-primary-hover shadow-glow-lg hover:shadow-glow transition-all duration-300 hover:scale-110 active:scale-95 text-primary-foreground border-[4px] border-background group"
            onClick={() => console.log("Voice FAB clicked")}
          >
            <Mic className="w-7 h-7 transition-transform duration-300 group-hover:scale-110" />
            {/* Inner shimmer effect */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-t from-transparent via-white/10 to-white/20 pointer-events-none" />
          </Button>
        </div>

        {/* Nav Items Container */}
        <div className="absolute inset-x-0 bottom-0 h-[68px] flex items-center justify-between px-1 z-10">
          {/* Left Side Nav Items */}
          <div className="flex items-center justify-evenly flex-1 max-w-[45%]">
            <NavItem item={navItems[0]} isActive={location.pathname === navItems[0].path} onClick={() => navigate(navItems[0].path)} />
            <NavItem item={navItems[1]} isActive={location.pathname.startsWith(navItems[1].path)} onClick={() => navigate(navItems[1].path)} />
            <NavItem item={navItems[2]} isActive={location.pathname.startsWith(navItems[2].path)} onClick={() => navigate(navItems[2].path)} />
          </div>

          {/* Center Spacer for FAB */}
          <div className="w-[72px] shrink-0" />

          {/* Right Side Nav Items */}
          <div className="flex items-center justify-evenly flex-1 max-w-[45%]">
            <NavItem item={navItems[3]} isActive={location.pathname.startsWith(navItems[3].path)} onClick={() => navigate(navItems[3].path)} />
            <NavItem item={navItems[4]} isActive={location.pathname.startsWith(navItems[4].path)} onClick={() => navigate(navItems[4].path)} />
            <NavItem item={navItems[5]} isActive={location.pathname.startsWith(navItems[5].path)} onClick={() => navigate(navItems[5].path)} />
          </div>
        </div>
      </div>

      {/* Safe area padding for devices with home indicator */}
      <div className="h-safe-bottom bg-card/95 backdrop-blur-xl" />
    </div>
  );
}

function NavItem({ item, isActive, onClick }: { item: any, isActive: boolean, onClick: () => void }) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center justify-center h-14 min-w-[48px] px-1 rounded-lg transition-all duration-300 active:scale-90 group",
        isActive
          ? "text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-primary/5"
      )}
    >
      {/* Active Background Indicator */}
      {isActive && (
        <div className="absolute inset-0 bg-primary/10 rounded-lg animate-fade-in" />
      )}

      {/* Icon Container */}
      <div className={cn(
        "relative transition-all duration-300 ease-out",
        isActive ? "scale-110 -translate-y-0.5" : "group-hover:scale-105 group-hover:-translate-y-0.5"
      )}>
        <Icon className={cn(
          "w-5 h-5 transition-all duration-300",
          isActive && "drop-shadow-[0_0_8px_rgba(var(--primary),0.5)]"
        )} />
        {/* Icon Glow */}
        {isActive && (
          <div className="absolute inset-0 bg-primary/40 blur-md rounded-full -z-10" />
        )}
      </div>

      {/* Label */}
      <span className={cn(
        "text-[8px] font-semibold mt-0.5 transition-all duration-300 tracking-wide truncate max-w-full",
        isActive
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-1 group-hover:opacity-70 group-hover:translate-y-0"
      )}>
        {item.label}
      </span>

      {/* Active Indicator Dot */}
      {isActive && (
        <span className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-primary animate-pulse" />
      )}
    </button>
  );
}