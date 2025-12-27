import { ReactNode } from 'react';
import { ArrowLeft, Plus, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  backPath?: string;
  showSettings?: boolean;
  action?: {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
  };
  className?: string;
}

export function PageHeader({ 
  title, 
  subtitle, 
  showBack, 
  backPath,
  showSettings,
  action,
  className 
}: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className={cn(
      "header-premium animate-slide-down px-4 sm:px-6",
      className
    )}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {showBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => backPath ? navigate(backPath) : navigate(-1)}
              className="shrink-0 -ml-2 hover:bg-primary/10 active:scale-95 transition-all duration-200"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground truncate">{title}</h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {showSettings && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/settings')}
              className="shrink-0 hover:bg-primary/10 active:scale-95 transition-all duration-200"
            >
              <Settings className="w-5 h-5" />
            </Button>
          )}
          
          {action && (
            <Button 
              onClick={action.onClick}
              size="sm"
              className="shrink-0 gap-1.5 shadow-glow-sm hover:shadow-glow transition-all duration-300 btn-press"
            >
              {action.icon || <Plus className="w-4 h-4" />}
              <span className="hidden sm:inline">{action.label}</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}