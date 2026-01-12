import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { IconContainer } from './icon-container';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'destructive';
  className?: string;
}

export function StatCard({
  label,
  value,
  icon,
  trend,
  variant = 'default',
  className
}: StatCardProps) {
  const variantStyles = {
    default: 'card-premium',
    primary: 'bg-primary/5 border-primary/20 backdrop-blur-md',
    success: 'bg-success/5 border-success/20 backdrop-blur-md',
    warning: 'bg-warning/5 border-warning/20 backdrop-blur-md',
    destructive: 'bg-destructive/5 border-destructive/20 backdrop-blur-md',
  };



  return (
    <div className={cn(
      "relative overflow-hidden group p-5 transition-all duration-300",
      "hover:-translate-y-1 hover:shadow-premium-lg",
      variantStyles[variant],
      className
    )}>
      {/* Background decoration */}
      <div className="absolute top-0 right-0 -mr-8 -mt-8 w-24 h-24 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-2xl group-hover:bg-white/10 transition-colors" />

      <div className="flex items-start justify-between gap-4 relative z-10">
        <div className="space-y-2 min-w-0 flex-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className="text-3xl font-bold tracking-tight truncate text-foreground">{value}</p>

          {trend && (
            <div className="flex items-center gap-2 mt-1">
              <span className={cn(
                "text-xs font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5",
                trend.isPositive ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
              )}>
                <span className={cn(
                  "transition-transform",
                  trend.isPositive ? "rotate-0" : "rotate-180"
                )}>↑</span>
                {Math.abs(trend.value)}%
              </span>
              <span className="text-xs text-muted-foreground/80">vs last month</span>
            </div>
          )}
        </div>

        {icon && (
          <IconContainer
            icon={icon}
            variant={variant === 'default' ? 'primary' : variant as any}
            className="group-hover:scale-110 transition-transform duration-300 shadow-glow-sm"
          />
        )}
      </div>
    </div>
  );
}