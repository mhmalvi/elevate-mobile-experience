import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { SearchInput } from '@/components/ui/search-input';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { PremiumCard } from '@/components/ui/premium-card';
import { Button } from '@/components/ui/button';
import { JobCalendarView } from '@/components/jobs/JobCalendarView';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Briefcase, Calendar, MapPin, List, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';

type ViewMode = 'list' | 'calendar';

export default function Jobs() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  useEffect(() => {
    if (user) fetchJobs();
  }, [user]);

  const fetchJobs = async () => {
    const { data } = await supabase
      .from('jobs')
      .select('*, clients(name)')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });
    setJobs(data || []);
    setLoading(false);
  };

  const filteredJobs = useMemo(() => {
    if (!search.trim()) return jobs;
    const term = search.toLowerCase();
    return jobs.filter(job => 
      job.title?.toLowerCase().includes(term) ||
      job.clients?.name?.toLowerCase().includes(term) ||
      job.site_address?.toLowerCase().includes(term)
    );
  }, [jobs, search]);

  return (
    <MobileLayout>
      <PageHeader 
        title="Jobs"
        subtitle={`${jobs.length} total`}
        action={{
          label: "New Job",
          onClick: () => navigate('/jobs/new'),
        }}
      />
      
      <div className="p-4 space-y-4 animate-fade-in">
        {/* View Toggle */}
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
            className="flex-1"
          >
            <List className="w-4 h-4 mr-2" />
            List
          </Button>
          <Button
            variant={viewMode === 'calendar' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('calendar')}
            className="flex-1"
          >
            <CalendarDays className="w-4 h-4 mr-2" />
            Calendar
          </Button>
        </div>

        {viewMode === 'list' && jobs.length > 0 && (
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search jobs, clients..."
          />
        )}

        {loading ? (
          <ListSkeleton count={5} />
        ) : viewMode === 'calendar' ? (
          <JobCalendarView 
            jobs={jobs}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        ) : filteredJobs.length === 0 && search ? (
          <EmptyState
            icon={<Briefcase className="w-8 h-8" />}
            title="No matches found"
            description={`No jobs matching "${search}". Try a different search term.`}
          />
        ) : jobs.length === 0 ? (
          <EmptyState
            icon={<Briefcase className="w-8 h-8" />}
            title="No jobs yet, mate!"
            description="Track your jobs from quote to completion. She'll be right!"
            action={{
              label: "Create Job",
              onClick: () => navigate('/jobs/new'),
            }}
          />
        ) : (
          <div className="space-y-3">
            {filteredJobs.map((job, index) => (
              <PremiumCard
                key={job.id}
                onClick={() => navigate(`/jobs/${job.id}`)}
                className="animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` } as React.CSSProperties}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold truncate text-foreground">{job.title}</h3>
                    <p className="text-sm text-muted-foreground truncate">
                      {job.clients?.name || 'No client assigned'}
                    </p>
                  </div>
                  <StatusBadge status={job.status} />
                </div>
                
                <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
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
              </PremiumCard>
            ))}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}