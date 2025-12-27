import { useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Briefcase, 
  FileText, 
  Settings, 
  Receipt
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { path: '/quotes', label: 'Quotes', icon: FileText },
  { path: '/jobs', label: 'Jobs', icon: Briefcase },
  { path: '/invoices', label: 'Invoices', icon: Receipt },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="bottom-nav">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || 
            (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
          const Icon = item.icon;
          
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "relative flex flex-col items-center justify-center flex-1 h-full touch-target-sm transition-all duration-200",
                "active:scale-95",
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className={cn(
                "relative flex items-center justify-center w-10 h-8 rounded-xl transition-all duration-300",
                isActive && "bg-primary/15"
              )}>
                <Icon 
                  className={cn(
                    "w-5 h-5 transition-all duration-200",
                    isActive && "scale-110"
                  )} 
                />
                {isActive && (
                  <div className="absolute inset-0 rounded-xl bg-primary/10 animate-pulse-glow" 
                       style={{ animationDuration: '3s' }} />
                )}
              </div>
              <span className={cn(
                "text-[10px] mt-0.5 transition-all duration-200",
                isActive ? "font-semibold" : "font-medium"
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}