import { ReactNode } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  backPath?: string;
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
  action,
  className 
}: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className={cn(
      "sticky top-0 z-40 glass px-4 py-4 safe-top",
      className
    )}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {showBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => backPath ? navigate(backPath) : navigate(-1)}
              className="shrink-0 -ml-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <div>
            <h1 className="text-xl font-bold text-foreground">{title}</h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
        
        {action && (
          <Button 
            onClick={action.onClick}
            size="sm"
            className="shrink-0 gap-1.5"
          >
            {action.icon || <Plus className="w-4 h-4" />}
            <span className="hidden sm:inline">{action.label}</span>
          </Button>
        )}
      </div>
    </header>
  );
}
