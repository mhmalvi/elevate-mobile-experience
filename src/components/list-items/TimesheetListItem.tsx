import React from 'react';
import { useNavigate } from 'react-router-dom';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';
import {
  Clock,
  ChevronRight,
  CheckCircle2,
  Send,
  FileEdit,
  XCircle,
  User,
} from 'lucide-react';
import { format, addDays, parseISO, isThisWeek } from 'date-fns';

const statusConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  draft: { icon: FileEdit, color: 'text-muted-foreground' },
  submitted: { icon: Send, color: 'text-blue-500' },
  approved: { icon: CheckCircle2, color: 'text-green-500' },
  rejected: { icon: XCircle, color: 'text-destructive' },
};

interface TimesheetListItemProps {
  timesheet: {
    id: string;
    member_id: string;
    week_starting: string;
    status: string;
    total_hours: number;
    member_name?: string;
  };
  index: number;
  currentUserId?: string;
  canManageTeam: boolean;
}

export const TimesheetListItem = React.memo(function TimesheetListItem({
  timesheet: ts,
  index,
  currentUserId,
  canManageTeam,
}: TimesheetListItemProps) {
  const navigate = useNavigate();

  const StatusIcon = statusConfig[ts.status]?.icon || FileEdit;
  const statusColor = statusConfig[ts.status]?.color || 'text-muted-foreground';
  const isCurrent = isThisWeek(parseISO(ts.week_starting), { weekStartsOn: 1 });

  const formatWeekRange = (weekStarting: string) => {
    const start = parseISO(weekStarting);
    const end = addDays(start, 6);
    return `${format(start, 'dd MMM')} - ${format(end, 'dd MMM yyyy')}`;
  };

  return (
    <button
      onClick={() => navigate(`/timesheets/${ts.id}`)}
      className={cn(
        "w-full p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 text-left",
        "hover:bg-card hover:border-primary/20 hover:shadow-lg",
        "transition-all duration-300 animate-fade-in",
        isCurrent && "ring-1 ring-primary/30"
      )}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className={cn(
            "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
            ts.status === 'approved' ? 'bg-green-500/10' :
            ts.status === 'submitted' ? 'bg-blue-500/10' :
            ts.status === 'rejected' ? 'bg-destructive/10' :
            'bg-primary/10'
          )}>
            <StatusIcon className={cn("w-5 h-5", statusColor)} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground text-sm">
                {formatWeekRange(ts.week_starting)}
              </h3>
              {isCurrent && (
                <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-md">
                  THIS WEEK
                </span>
              )}
            </div>
            {canManageTeam && ts.member_id !== currentUserId && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                <User className="w-3 h-3" />
                <span className="truncate">{ts.member_name}</span>
              </div>
            )}
            <div className="flex items-center gap-3 mt-1.5">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span className="font-medium">{Number(ts.total_hours).toFixed(1)}h</span>
              </div>
              <StatusBadge status={ts.status} />
            </div>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
      </div>
    </button>
  );
});
