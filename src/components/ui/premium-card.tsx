import { cn } from '@/lib/utils';
import { ReactNode, CSSProperties } from 'react';

interface PremiumCardProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  interactive?: boolean;
  style?: CSSProperties;
}

export function PremiumCard({ children, onClick, className, interactive = true, style }: PremiumCardProps) {
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      onClick={onClick}
      style={style}
      className={cn(
        "w-full p-4 text-left",
        "bg-card/80 backdrop-blur-sm",
        "rounded-xl border border-border/50",
        "shadow-premium",
        interactive && "hover:bg-card hover:border-border/80 hover:shadow-glow active:scale-[0.97]",
        "transition-all duration-200",
        className
      )}
    >
      {children}
    </Component>
  );
}
