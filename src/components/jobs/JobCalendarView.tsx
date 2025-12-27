import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar } from '@/components/ui/calendar';
import { StatusBadge } from '@/components/ui/status-badge';
import { format, isSameDay, isAfter, startOfDay } from 'date-fns';
import { Clock, MapPin, ChevronRight, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';

type JobStatus = 'quoted' | 'approved' | 'scheduled' | 'in_progress' | 'completed' | 'invoiced';

interface Job {
  id: string;
  title: string;
  status: JobStatus;
  scheduled_date: string | null;
  start_time: string | null;
  end_time: string | null;
  site_address: string | null;
  clients?: { name: string } | null;
}

interface JobCalendarViewProps {
  jobs: Job[];
  selectedDate: Date | undefined;
  onSelectDate: (date: Date | undefined) => void;
}

// Status color mapping
const statusColors: Record<JobStatus, { bg: string; border: string; text: string }> = {
  completed: { bg: 'bg-success/20', border: 'border-success/40', text: 'text-success' },
  invoiced: { bg: 'bg-success/20', border: 'border-success/40', text: 'text-success' },
  in_progress: { bg: 'bg-primary/20', border: 'border-primary/40', text: 'text-primary' },
  scheduled: { bg: 'bg-warning/20', border: 'border-warning/40', text: 'text-warning' },
  approved: { bg: 'bg-warning/20', border: 'border-warning/40', text: 'text-warning' },
  quoted: { bg: 'bg-muted', border: 'border-border', text: 'text-muted-foreground' },
};

export function JobCalendarView({ jobs, selectedDate, onSelectDate }: JobCalendarViewProps) {
  const navigate = useNavigate();

  // Group jobs by date
  const jobsByDate = useMemo(() => {
    const map = new Map<string, Job[]>();
    jobs.forEach(job => {
      if (job.scheduled_date) {
        const dateKey = format(new Date(job.scheduled_date), 'yyyy-MM-dd');
        if (!map.has(dateKey)) {
          map.set(dateKey, []);
        }
        map.get(dateKey)!.push(job);
      }
    });
    return map;
  }, [jobs]);

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

  // Get upcoming jobs (next 3 jobs from today)
  const upcomingJobs = useMemo(() => {
    const today = startOfDay(new Date());
    return jobs
      .filter(job => job.scheduled_date && isAfter(new Date(job.scheduled_date), today))
      .sort((a, b) => new Date(a.scheduled_date!).getTime() - new Date(b.scheduled_date!).getTime())
      .slice(0, 3);
  }, [jobs]);

  // Get job count and dominant status for a date
  const getDateInfo = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const dateJobs = jobsByDate.get(dateKey) || [];
    if (dateJobs.length === 0) return null;

    // Determine dominant status (priority: in_progress > scheduled > approved > completed > invoiced > quoted)
    const statusPriority: JobStatus[] = ['in_progress', 'scheduled', 'approved', 'completed', 'invoiced', 'quoted'];
    let dominantStatus: JobStatus = 'quoted';
    for (const status of statusPriority) {
      if (dateJobs.some(job => job.status === status)) {
        dominantStatus = status;
        break;
      }
    }

    return {
      count: dateJobs.length,
      status: dominantStatus,
    };
  };

  return (
    <div className="space-y-4">
      {/* Premium Calendar */}
      <div className="bg-card/80 backdrop-blur-sm rounded-xl border border-border/50 p-4 shadow-premium">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={onSelectDate}
          className="w-full"
          classNames={{
            day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
            day: "h-12 w-12 p-0 font-normal aria-selected:opacity-100 relative hover:bg-accent/50 rounded-lg transition-colors",
            cell: "text-center p-0",
            head_cell: "text-muted-foreground font-medium text-xs w-12",
            caption: "flex justify-center pt-1 relative items-center mb-4",
            caption_label: "text-base font-semibold",
            nav_button: "h-8 w-8 bg-transparent p-0 opacity-70 hover:opacity-100 hover:bg-accent rounded-lg transition-colors",
            table: "w-full border-collapse",
            row: "flex w-full mt-1 gap-0.5",
          }}
          components={{
            DayContent: ({ date }) => {
              const info = getDateInfo(date);
              const isSelected = selectedDate && isSameDay(date, selectedDate);
              
              return (
                <div className="relative w-full h-full flex flex-col items-center justify-center">
                  <span className={cn(
                    "text-sm font-medium",
                    isSelected && "text-primary-foreground"
                  )}>
                    {date.getDate()}
                  </span>
                  {info && (
                    <div className={cn(
                      "absolute bottom-0.5 flex items-center justify-center",
                      "min-w-[18px] h-[18px] rounded-full text-[10px] font-bold",
                      isSelected 
                        ? "bg-primary-foreground/30 text-primary-foreground" 
                        : statusColors[info.status].bg,
                      !isSelected && statusColors[info.status].text
                    )}>
                      {info.count}
                    </div>
                  )}
                </div>
              );
            },
          }}
        />
      </div>

      {/* Selected Date Jobs */}
      {selectedDate && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              {format(selectedDate, 'EEEE, d MMMM')}
            </h3>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {jobsForSelectedDate.length} job{jobsForSelectedDate.length !== 1 ? 's' : ''}
            </span>
          </div>
          
          {jobsForSelectedDate.length === 0 ? (
            <div className="p-6 text-center rounded-xl bg-card/50 border border-dashed border-border/50">
              <CalendarDays className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                No jobs scheduled for this day
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {jobsForSelectedDate.map((job) => (
                <JobCard key={job.id} job={job} onClick={() => navigate(`/jobs/${job.id}`)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upcoming Jobs Section */}
      {!selectedDate && upcomingJobs.length > 0 && (
        <div className="space-y-3 animate-fade-in">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Upcoming Jobs
          </h3>
          <div className="space-y-2">
            {upcomingJobs.map((job) => (
              <JobCard 
                key={job.id} 
                job={job} 
                onClick={() => navigate(`/jobs/${job.id}`)} 
                showDate 
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Premium Job Card Component
interface JobCardProps {
  job: Job;
  onClick: () => void;
  showDate?: boolean;
}

function JobCard({ job, onClick, showDate = false }: JobCardProps) {
  const colors = statusColors[job.status];
  
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full p-4 rounded-xl border text-left transition-all duration-200",
        "bg-card/80 backdrop-blur-sm hover:shadow-premium",
        "hover:-translate-y-0.5 active:scale-[0.98]",
        colors.border
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div className={cn("w-2 h-2 rounded-full", colors.bg.replace('/20', ''))} />
            <h4 className="font-semibold truncate text-foreground">{job.title}</h4>
          </div>
          
          <p className="text-sm text-muted-foreground truncate mb-2">
            {job.clients?.name || 'No client'}
          </p>
          
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {showDate && job.scheduled_date && (
              <span className="flex items-center gap-1">
                <CalendarDays className="w-3 h-3" />
                {format(new Date(job.scheduled_date), 'EEE, d MMM')}
              </span>
            )}
            {job.start_time && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {job.start_time}{job.end_time && ` - ${job.end_time}`}
              </span>
            )}
            {job.site_address && (
              <span className="flex items-center gap-1 truncate max-w-[150px]">
                <MapPin className="w-3 h-3" />
                {job.site_address}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={job.status} />
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
    </button>
  );
}
