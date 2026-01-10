import { cn } from '@/lib/utils';

type StatusType =
  | 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired'
  | 'quoted' | 'approved' | 'scheduled' | 'in_progress' | 'completed' | 'invoiced'
  | 'paid' | 'partially_paid' | 'overdue' | 'cancelled' | 'active';

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

const statusConfig: Record<StatusType, { label: string; className: string; dotColor: string }> = {
  // Quote statuses
  draft: {
    label: 'Draft',
    className: 'bg-muted text-muted-foreground border-muted-foreground/20',
    dotColor: 'bg-muted-foreground'
  },
  sent: {
    label: 'Sent',
    className: 'bg-primary/15 text-primary border-primary/30',
    dotColor: 'bg-primary'
  },
  viewed: {
    label: 'Viewed',
    className: 'bg-accent/15 text-accent border-accent/30',
    dotColor: 'bg-accent'
  },
  accepted: {
    label: 'Accepted',
    className: 'bg-success/15 text-success border-success/30',
    dotColor: 'bg-success'
  },
  declined: {
    label: 'Declined',
    className: 'bg-destructive/15 text-destructive border-destructive/30',
    dotColor: 'bg-destructive'
  },
  expired: {
    label: 'Expired',
    className: 'bg-muted text-muted-foreground border-muted-foreground/20',
    dotColor: 'bg-muted-foreground'
  },

  // Job statuses
  quoted: {
    label: 'Quoted',
    className: 'bg-muted text-muted-foreground border-muted-foreground/20',
    dotColor: 'bg-muted-foreground'
  },
  approved: {
    label: 'Approved',
    className: 'bg-success/15 text-success border-success/30',
    dotColor: 'bg-success'
  },
  scheduled: {
    label: 'Scheduled',
    className: 'bg-primary/15 text-primary border-primary/30',
    dotColor: 'bg-primary'
  },
  in_progress: {
    label: 'In Progress',
    className: 'bg-warning/15 text-warning border-warning/30',
    dotColor: 'bg-warning animate-pulse'
  },
  completed: {
    label: 'Completed',
    className: 'bg-success/15 text-success border-success/30',
    dotColor: 'bg-success'
  },
  invoiced: {
    label: 'Invoiced',
    className: 'bg-accent/15 text-accent border-accent/30',
    dotColor: 'bg-accent'
  },

  // Invoice statuses
  paid: {
    label: 'Paid',
    className: 'bg-success/15 text-success border-success/30',
    dotColor: 'bg-success'
  },
  partially_paid: {
    label: 'Partial',
    className: 'bg-warning/15 text-warning border-warning/30',
    dotColor: 'bg-warning'
  },
  overdue: {
    label: 'Overdue',
    className: 'bg-destructive/15 text-destructive border-destructive/30',
    dotColor: 'bg-destructive animate-pulse'
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-muted text-muted-foreground border-muted-foreground/20',
    dotColor: 'bg-muted-foreground'
  },
  active: {
    label: 'Active',
    className: 'bg-success/15 text-success border-success/30',
    dotColor: 'bg-success'
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || {
    label: status,
    className: 'bg-muted text-muted-foreground border-muted-foreground/20',
    dotColor: 'bg-muted-foreground'
  };

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
      "transition-all duration-300 shadow-sm",
      config.className,
      className
    )}>
      <div className="relative flex items-center justify-center">
        <span className={cn("absolute w-2.5 h-2.5 rounded-full animate-pulse-glow opacity-50", config.dotColor)} />
        <span className={cn("relative w-2 h-2 rounded-full", config.dotColor)} />
      </div>
      {config.label}
    </span>
  );
}