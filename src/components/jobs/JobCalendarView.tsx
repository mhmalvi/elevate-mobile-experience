import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar } from '@/components/ui/calendar';
import { StatusBadge } from '@/components/ui/status-badge';
import { format, isSameDay } from 'date-fns';

type JobStatus = 'quoted' | 'approved' | 'scheduled' | 'in_progress' | 'completed' | 'invoiced';

interface Job {
  id: string;
  title: string;
  status: JobStatus;
  scheduled_date: string | null;
  clients?: { name: string } | null;
}

interface JobCalendarViewProps {
  jobs: Job[];
  selectedDate: Date | undefined;
  onSelectDate: (date: Date | undefined) => void;
}

export function JobCalendarView({ jobs, selectedDate, onSelectDate }: JobCalendarViewProps) {
  const navigate = useNavigate();

  // Get dates that have jobs scheduled
  const scheduledDates = useMemo(() => {
    return jobs
      .filter(job => job.scheduled_date)
      .map(job => new Date(job.scheduled_date!));
  }, [jobs]);

  // Get jobs for selected date
  const jobsForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return jobs.filter(job => 
      job.scheduled_date && isSameDay(new Date(job.scheduled_date), selectedDate)
    );
  }, [jobs, selectedDate]);

  // Custom day render to show indicators
  const modifiers = {
    scheduled: scheduledDates,
  };

  const modifiersStyles = {
    scheduled: {
      fontWeight: 'bold' as const,
    },
  };

  return (
    <div className="space-y-4">
      <div className="bg-card/80 backdrop-blur-sm rounded-xl border border-border/50 p-4">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={onSelectDate}
          modifiers={modifiers}
          modifiersStyles={modifiersStyles}
          className="w-full"
          classNames={{
            day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
            day: "h-10 w-10 p-0 font-normal aria-selected:opacity-100 relative",
          }}
          components={{
            DayContent: ({ date }) => {
              const hasJob = scheduledDates.some(d => isSameDay(d, date));
              return (
                <div className="relative w-full h-full flex items-center justify-center">
                  {date.getDate()}
                  {hasJob && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-primary rounded-full" />
                  )}
                </div>
              );
            },
          }}
        />
      </div>

      {/* Jobs for selected date */}
      {selectedDate && (
        <div className="space-y-2">
          <h3 className="font-semibold text-foreground">
            {format(selectedDate, 'EEEE, d MMMM')}
          </h3>
          
          {jobsForSelectedDate.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No jobs scheduled for this day
            </p>
          ) : (
            <div className="space-y-2">
              {jobsForSelectedDate.map((job) => (
                <button
                  key={job.id}
                  onClick={() => navigate(`/jobs/${job.id}`)}
                  className="w-full p-4 bg-card/80 backdrop-blur-sm rounded-xl border border-border/50 text-left card-interactive"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="font-semibold truncate text-foreground">{job.title}</h4>
                      <p className="text-sm text-muted-foreground truncate">
                        {job.clients?.name || 'No client'}
                      </p>
                    </div>
                    <StatusBadge status={job.status} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}