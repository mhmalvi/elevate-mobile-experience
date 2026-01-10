import { ReactNode } from 'react';
import { BottomNav } from './BottomNav';

interface MobileLayoutProps {
  children: ReactNode;
  showNav?: boolean;
}

export function MobileLayout({ children, showNav = true }: MobileLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col relative">
      {/* Subtle gradient glow at the top */}
      <div className="fixed inset-x-0 top-0 h-32 gradient-glow pointer-events-none z-0" />

      <main className="flex-1 overflow-auto pb-40 relative z-10 scrollbar-hide">
        {children}
      </main>

      {showNav && <BottomNav />}
    </div>
  );
}