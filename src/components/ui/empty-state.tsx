import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LucideIcon, Plus } from 'lucide-react';

interface EmptyStateProps {
  icon?: ReactNode;
  Icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
    variant?: 'default' | 'outline' | 'premium';
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  variant?: 'default' | 'card' | 'minimal';
}

export function EmptyState({
  icon,
  Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  variant = 'default'
}: EmptyStateProps) {
  const variantStyles = {
    default: 'py-12 px-4',
    card: 'p-8 rounded-xl bg-card border border-border/50',
    minimal: 'py-6 px-4',
  };

  const renderIcon = () => {
    if (Icon) {
      return <Icon className="w-10 h-10" aria-hidden="true" />;
    }
    return icon;
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center animate-fade-in",
        variantStyles[variant],
        className
      )}
      role="status"
      aria-label={title}
    >
      {(icon || Icon) && (
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
          <div className={cn(
            "relative w-24 h-24 rounded-3xl flex items-center justify-center",
            "bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20",
            "shadow-premium-lg animate-float"
          )}>
            <div className="text-primary transform scale-150">
              {renderIcon()}
            </div>
          </div>
        </div>
      )}

      <h3 className="text-2xl font-bold text-foreground mb-2">
        {title}
      </h3>

      {description && (
        <p className="text-base text-muted-foreground max-w-[280px] mb-8 leading-relaxed">
          {description}
        </p>
      )}

      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-2 mt-2">
          {action && (
            <Button
              onClick={action.onClick}
              variant={action.variant || 'default'}
              className="min-w-[140px]"
            >
              {action.icon ? (
                <action.icon className="w-4 h-4 mr-2" aria-hidden="true" />
              ) : (
                <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
              )}
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              onClick={secondaryAction.onClick}
              variant="outline"
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// Preset empty states for common use cases
export function NoDataEmptyState({
  entityName,
  onAdd,
  addLabel
}: {
  entityName: string;
  onAdd?: () => void;
  addLabel?: string;
}) {
  return (
    <EmptyState
      title={`No ${entityName} yet`}
      description={`Get started by creating your first ${entityName.toLowerCase()}`}
      action={onAdd ? {
        label: addLabel || `Add ${entityName.slice(0, -1)}`,
        onClick: onAdd,
      } : undefined}
      variant="card"
    />
  );
}
