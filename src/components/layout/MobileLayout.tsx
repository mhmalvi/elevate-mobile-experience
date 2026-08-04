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

      {/*
        Bottom clearance must cover the whole nav assembly, not just the bar:
          voice FAB (56px) + gap (12px) + nav bar (64px) + padding (8px) ≈ 140px
        plus the safe-area inset. `pb-32` (128px) left the FAB sitting on top of
        the last ~28px of page content — measured at 390x844, content ran to
        y=716 while the FAB started at y=688.
      */}
      <main className="flex-1 overflow-auto pb-44 relative z-10 scrollbar-hide">
        {children}
      </main>

      {showNav && <BottomNav />}
    </div>
  );
}