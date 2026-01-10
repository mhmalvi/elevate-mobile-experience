import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface ListSkeletonProps {
  count?: number;
  className?: string;
}

export function ListSkeleton({ count = 5, className }: ListSkeletonProps) {
  return (
    <div
      className={cn("space-y-3", className)}
      role="status"
      aria-busy="true"
      aria-label="Loading list items"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="p-4 bg-card/50 backdrop-blur-sm rounded-xl border border-border/50 animate-pulse"
          style={{ animationDelay: `${i * 100}ms` }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-24 mt-3" />
        </div>
      ))}
      <span className="sr-only">Loading...</span>
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("p-4 bg-card/50 backdrop-blur-sm rounded-xl border border-border/50 animate-pulse", className)}
      role="status"
      aria-busy="true"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <Skeleton className="h-4 w-24 mt-3" />
    </div>
  );
}

export function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4 bg-card animate-pulse min-h-[100px]",
        className
      )}
      role="status"
      aria-busy="true"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-8 w-24" />
        </div>
        <Skeleton className="w-10 h-10 rounded-xl" />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div
      className="p-4 space-y-6"
      role="status"
      aria-busy="true"
      aria-label="Loading dashboard"
    >
      {/* Stats Grid Skeleton */}
      <div className="grid grid-cols-2 gap-3">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      {/* Quick Actions Skeleton */}
      <div className="flex gap-3">
        <Skeleton className="flex-1 h-14 rounded-xl" />
        <Skeleton className="flex-1 h-14 rounded-xl" />
      </div>

      {/* Recent Activity Skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-6 w-32" />
        <ListSkeleton count={3} />
      </div>

      <span className="sr-only">Loading dashboard...</span>
    </div>
  );
}

