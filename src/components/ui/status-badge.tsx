import { cn } from '@/lib/utils';

type StatusType = 
  | 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired'
  | 'quoted' | 'approved' | 'scheduled' | 'in_progress' | 'completed' | 'invoiced'
  | 'paid' | 'partially_paid' | 'overdue' | 'cancelled';

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  // Quote statuses
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground' },
  sent: { label: 'Sent', className: 'bg-primary/10 text-primary' },
  viewed: { label: 'Viewed', className: 'bg-accent/20 text-accent-foreground' },
  accepted: { label: 'Accepted', className: 'bg-success/10 text-success' },
  declined: { label: 'Declined', className: 'bg-destructive/10 text-destructive' },
  expired: { label: 'Expired', className: 'bg-muted text-muted-foreground' },
  
  // Job statuses
  quoted: { label: 'Quoted', className: 'bg-muted text-muted-foreground' },
  approved: { label: 'Approved', className: 'bg-success/10 text-success' },
  scheduled: { label: 'Scheduled', className: 'bg-primary/10 text-primary' },
  in_progress: { label: 'In Progress', className: 'bg-warning/10 text-warning' },
  completed: { label: 'Completed', className: 'bg-success/10 text-success' },
  invoiced: { label: 'Invoiced', className: 'bg-accent/20 text-accent-foreground' },
  
  // Invoice statuses
  paid: { label: 'Paid', className: 'bg-success/10 text-success' },
  partially_paid: { label: 'Partial', className: 'bg-warning/10 text-warning' },
  overdue: { label: 'Overdue', className: 'bg-destructive/10 text-destructive' },
  cancelled: { label: 'Cancelled', className: 'bg-muted text-muted-foreground' },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, className: 'bg-muted text-muted-foreground' };
  
  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold",
      config.className,
      className
    )}>
      {config.label}
    </span>
  );
}
