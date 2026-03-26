import { ReactNode } from 'react';
import { BottomNav } from './BottomNav';

interface MobileLayoutProps {
  children: ReactNode;
  showNav?: boolean;
}

export function MobileLayout({ children, showNav = true }: MobileLayoutProps) {
  return (
    <div className="h-dvh h-[100vh] bg-background flex flex-col relative overflow-hidden">
      {/* Subtle gradient glow at the top */}
      <div className="absolute inset-x-0 top-0 h-32 gradient-glow pointer-events-none z-0" />

      <main className="flex-1 overflow-auto relative z-10 scrollbar-hide">
        {children}
      </main>

      {showNav && <BottomNav />}
    </div>
  );
}