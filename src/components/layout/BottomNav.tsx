import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Receipt,
  FileText,
  Mic,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { VoiceCommandSheet } from '@/components/VoiceCommandSheet';

/**
 * LAYOUT NOTE
 *
 * The previous version split the bar into two 42%-wide groups either side of an
 * inline FAB. On a 360px phone that left roughly 137px of track for three 48px
 * targets, so the items collided at the low end of the device range — and to
 * make room, labels were rendered at `opacity-0` unless the tab was active.
 * Six unlabelled icons is not navigable: `FileText` (Quotes) and `Receipt`
 * (Invoices) are near-identical glyphs for the app's two most confusable
 * concepts.
 *
 * The FAB floats ABOVE the bar rather than sitting inside it: voice is an
 * action, not a destination, and mixing the two is what cramped the bar in the
 * first place.
 *
 * WHY FIVE ITEMS, NOT SIX
 *
 * Six was over both platform guidelines (Material 3 says 3–5 destinations, iOS
 * HIG tops out near 5), and it broke down on small phones. Each item gets
 * `(screenWidth - 40) / n` of track:
 *
 *          six items      five items
 *   411dp   61.8px         74.2px
 *   360dp   53.3px         64.0px
 *   320dp   46.7px         56.0px
 *
 * The widest label ("Invoices", "Settings") needs 45px, so at 320dp six items
 * left under 2px of gutter between adjacent labels — and 46.7px is below the
 * 48dp minimum touch target.
 *
 * Settings was the item to drop: it is the lowest-frequency destination here
 * and it is the only one with no day-to-day workflow behind it. It now lives in
 * the dashboard header, two taps from anywhere via Home — the same place most
 * apps put it. Every other destination stays reachable in one tap, which
 * matters because this bar is the app's only navigation.
 */

interface NavItemDef {
  path: string;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItemDef[] = [
  { path: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { path: '/quotes', label: 'Quotes', icon: FileText },
  { path: '/jobs', label: 'Jobs', icon: Briefcase },
  { path: '/invoices', label: 'Invoices', icon: Receipt },
  { path: '/clients', label: 'Clients', icon: Users },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  // Derive directly from the router rather than mirroring it into state — the
  // duplicate `useState`/`useEffect` pair only created a frame where the
  // highlight lagged the actual route.
  const isActive = (path: string) =>
    path === '/dashboard'
      ? location.pathname === path
      : location.pathname.startsWith(path);

  return (
    // `safe-bottom` is applied here ONLY. It used to be set on both this
    // wrapper (pb-safe-bottom) and the inner container (mb-safe-bottom), so the
    // inset was counted twice — about 68px of dead space on a gesture-nav phone.
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up safe-bottom pointer-events-none">
      <div className="relative w-full max-w-lg mx-auto px-4 pb-2 pointer-events-none">

        {/* Voice FAB — floats above the bar so the bar keeps its full width. */}
        <div className="flex justify-center pointer-events-none">
          <div className="relative pointer-events-auto group mb-3">
            <div className="absolute inset-0 rounded-full bg-primary/40 blur-2xl animate-pulse-glow" />
            <VoiceCommandSheet>
              <Button
                size="icon"
                aria-label="Voice assistant"
                className={cn(
                  'relative w-14 h-14 rounded-full bg-primary hover:bg-primary-hover',
                  'shadow-glow-lg transition-all duration-300 hover:scale-105 active:scale-90',
                  // Ring uses the theme token instead of the previous hardcoded
                  // #F5F5F5 / #121212 — the dark hex did not match the actual
                  // dark background (#002420) and left a visible seam.
                  'border-4 border-background',
                )}
              >
                <div className="absolute inset-0 rounded-full bg-white/20 to-transparent opacity-100" />
                <Mic className="w-6 h-6 text-primary-foreground drop-shadow-md" />
              </Button>
            </VoiceCommandSheet>
          </div>
        </div>

        {/* Nav bar */}
        <nav
          aria-label="Main"
          className={cn(
            'pointer-events-auto relative flex items-stretch justify-between',
            'h-[64px] px-1 rounded-[1.75rem] overflow-hidden',
            'bg-card/90 backdrop-blur-2xl border border-border/60',
            'shadow-[0_8px_32px_hsl(var(--shadow-color))]',
          )}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent opacity-50 pointer-events-none" />

          {NAV_ITEMS.map((item) => (
            <NavItem
              key={item.path}
              item={item}
              isActive={isActive(item.path)}
              onClick={() => navigate(item.path)}
            />
          ))}
        </nav>
      </div>
    </div>
  );
}

function NavItem({
  item,
  isActive,
  onClick,
}: {
  item: NavItemDef;
  isActive: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;

  return (
    <button
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'relative z-10 flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5',
        'rounded-2xl transition-colors duration-200',
        // 48px is the minimum comfortable touch target; flex-1 keeps the five
        // items evenly distributed instead of overflowing a fixed-width group.
        'min-h-[48px] active:scale-95',
        isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {isActive && (
        <span className="absolute inset-x-1 inset-y-1 bg-primary/10 rounded-2xl border border-primary/20" />
      )}

      <Icon
        className={cn('relative w-5 h-5 shrink-0 transition-transform duration-200',
          isActive && 'scale-110')}
        strokeWidth={isActive ? 2.5 : 2}
      />

      {/* Always visible. Previously `opacity-0` unless active, which left the
          user looking at six unlabelled icons. */}
      <span
        className={cn(
          'relative text-[10px] leading-none font-semibold tracking-tight',
          'max-w-full truncate px-0.5',
          isActive ? 'text-primary' : 'text-muted-foreground',
        )}
      >
        {item.label}
      </span>
    </button>
  );
}
