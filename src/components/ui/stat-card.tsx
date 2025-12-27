import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

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
    default: 'bg-card border-border',
    primary: 'bg-primary/10 border-primary/25',
    success: 'bg-success/10 border-success/25',
    warning: 'bg-warning/10 border-warning/25',
    destructive: 'bg-destructive/10 border-destructive/25',
  };

  const iconContainerStyles = {
    default: 'bg-muted',
    primary: 'bg-primary/20',
    success: 'bg-success/20',
    warning: 'bg-warning/20',
    destructive: 'bg-destructive/20',
  };

  const iconStyles = {
    default: 'text-muted-foreground',
    primary: 'text-primary',
    success: 'text-success',
    warning: 'text-warning',
    destructive: 'text-destructive',
  };

  return (
    <div className={cn(
      "rounded-xl border p-4 transition-all duration-300",
      "hover:shadow-premium hover:-translate-y-0.5",
      "active:scale-[0.98]",
      "min-h-[100px]",
      variantStyles[variant],
      className
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold tracking-tight truncate">{value}</p>
          {trend && (
            <p className={cn(
              "text-xs font-semibold flex items-center gap-1",
              trend.isPositive ? "text-success" : "text-destructive"
            )}>
              <span className={cn(
                "inline-block transition-transform",
                trend.isPositive ? "rotate-0" : "rotate-180"
              )}>↑</span>
              {Math.abs(trend.value)}% this month
            </p>
          )}
        </div>
        {icon && (
          <div className={cn(
            "p-2.5 rounded-xl shrink-0",
            iconContainerStyles[variant]
          )}>
            <div className={iconStyles[variant]}>
              {icon}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}