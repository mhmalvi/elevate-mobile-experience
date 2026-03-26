import React from 'react';
import { useNavigate } from 'react-router-dom';
import { StatusBadge, type StatusType } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';
import { Briefcase, Calendar, MapPin, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

interface JobListItemProps {
  job: {
    id: string;
    title: string | null;
    status: string;
    scheduled_date: string | null;
    site_address: string | null;
    clients?: { name: string | null } | null;
  };
  index: number;
}

export const JobListItem = React.memo(function JobListItem({ job, index }: JobListItemProps) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(`/jobs/${job.id}`)}
      className={cn(
        "w-full p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50",
        "hover:bg-card hover:border-primary/20 hover:shadow-lg",
        "transition-all duration-300 group animate-fade-in text-left"
      )}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
            <Briefcase className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold truncate text-foreground">{job.title}</h3>
            <p className="text-sm text-muted-foreground truncate">
              {job.clients?.name || 'No client assigned'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={job.status as StatusType} />
          <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground pl-13">
        {job.scheduled_date && (
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {format(new Date(job.scheduled_date), 'EEE, d MMM')}
          </div>
        )}
        {job.site_address && (
          <div className="flex items-center gap-1.5 truncate">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{job.site_address}</span>
          </div>
        )}
      </div>
    </button>
  );
});
