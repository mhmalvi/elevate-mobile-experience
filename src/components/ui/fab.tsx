import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FABProps {
  onClick: () => void;
  icon?: React.ReactNode;
  className?: string;
  label?: string;
}

export function FAB({ onClick, icon, className, label }: FABProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "fixed bottom-24 right-4 z-40",
        "w-14 h-14 rounded-full",
        "bg-primary text-primary-foreground",
        "shadow-premium hover:shadow-glow",
        "flex items-center justify-center",
        "active:scale-95 transition-all duration-200",
        "animate-scale-in",
        className
      )}
      aria-label={label || "Quick action"}
    >
      {icon || <Plus className="w-6 h-6" />}
    </button>
  );
}
