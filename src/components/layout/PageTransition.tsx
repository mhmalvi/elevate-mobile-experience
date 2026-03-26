import { ReactNode } from 'react';

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

export function PageTransition({ children, className }: PageTransitionProps) {
  // Respect prefers-reduced-motion: skip animation entirely for users who prefer it.
  // The CSS @media block in index.css handles all other animation classes globally,
  // but the inline style here needs explicit handling.
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div
      className={`animate-fade-in h-full w-full ${className || ''}`}
      style={prefersReducedMotion ? undefined : { animationDuration: '0.2s' }}
    >
      {children}
    </div>
  );
}
