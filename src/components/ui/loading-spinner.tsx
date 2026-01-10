import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
    size?: 'sm' | 'default' | 'lg';
    className?: string;
    fullScreen?: boolean;
    text?: string;
}

const sizeClasses = {
    sm: 'w-4 h-4',
    default: 'w-8 h-8',
    lg: 'w-12 h-12',
};

export function LoadingSpinner({
    size = 'default',
    className,
    fullScreen = false,
    text
}: LoadingSpinnerProps) {
    const spinner = (
        <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
            <Loader2
                className={cn(
                    "animate-spin text-primary",
                    sizeClasses[size]
                )}
                aria-hidden="true"
            />
            {text && (
                <p className="text-sm text-muted-foreground animate-pulse">{text}</p>
            )}
            <span className="sr-only">{text || 'Loading...'}</span>
        </div>
    );

    if (fullScreen) {
        return (
            <div
                className="min-h-screen flex items-center justify-center bg-background"
                role="status"
                aria-busy="true"
            >
                {spinner}
            </div>
        );
    }

    return (
        <div role="status" aria-busy="true">
            {spinner}
        </div>
    );
}

// Alternative: Border-based spinner for matching existing design
export function BorderSpinner({
    size = 'default',
    className
}: Omit<LoadingSpinnerProps, 'text' | 'fullScreen'>) {
    const borderSizes = {
        sm: 'w-4 h-4 border-2',
        default: 'w-8 h-8 border-4',
        lg: 'w-12 h-12 border-4',
    };

    return (
        <div
            className={cn(
                "border-primary border-t-transparent rounded-full animate-spin",
                borderSizes[size],
                className
            )}
            role="status"
            aria-busy="true"
        >
            <span className="sr-only">Loading...</span>
        </div>
    );
}
