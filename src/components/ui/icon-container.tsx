import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface IconContainerProps {
    icon: LucideIcon | React.ReactNode;
    variant?: 'primary' | 'secondary' | 'accent' | 'glass' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export function IconContainer({
    icon: Icon,
    variant = 'primary',
    size = 'md',
    className
}: IconContainerProps) {
    const sizeStyles = {
        sm: 'w-8 h-8 rounded-lg p-1.5',
        md: 'w-10 h-10 rounded-xl p-2',
        lg: 'w-14 h-14 rounded-2xl p-3',
    };

    const iconSizeStyles = {
        sm: 'w-4 h-4',
        md: 'w-5 h-5',
        lg: 'w-7 h-7',
    };

    const variantStyles = {
        primary: 'bg-gradient-to-br from-primary/20 to-primary/5 border-primary/10 text-primary shadow-sm',
        secondary: 'bg-gradient-to-br from-secondary/20 to-secondary/5 border-secondary/10 text-secondary shadow-sm',
        accent: 'bg-gradient-to-br from-accent/20 to-accent/5 border-accent/10 text-accent shadow-sm',
        glass: 'glass-subtle border-white/10 text-foreground shadow-premium',
        ghost: 'bg-muted/30 border-muted-foreground/10 text-muted-foreground',
    };

    const isLucideIcon = typeof Icon === 'function' || (typeof Icon === 'object' && Icon !== null && 'displayName' in Icon);

    return (
        <div className={cn(
            "flex items-center justify-center shrink-0 border",
            sizeStyles[size],
            variantStyles[variant],
            className
        )}>
            {isLucideIcon ? (
                // @ts-ignore - Icon is a components
                <Icon className={cn(iconSizeStyles[size])} />
            ) : (
                Icon
            )}
        </div>
    );
}
