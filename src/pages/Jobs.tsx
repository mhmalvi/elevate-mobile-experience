import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { SearchInput } from '@/components/ui/search-input';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { Button } from '@/components/ui/button';
import { JobCalendarView } from '@/components/jobs/JobCalendarView';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useTeam } from '@/hooks/useTeam';
import { useOfflineJobs } from '@/lib/offline/offlineHooks';
import { cn } from '@/lib/utils';

import {
  Briefcase,
  Calendar,
  MapPin,
  List,
  CalendarDays,
  WifiOff,
  ChevronRight,
  Plus,
  Sparkles,
  Users
} from 'lucide-react';
import { format } from 'date-fns';

type ViewMode = 'list' | 'calendar';

export default function Jobs() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { teamMembers } = useTeam();
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [filterMember, setFilterMember] = useState<string>('');

  // Use offline-first hook
  const { jobs, loading, isOnline } = useOfflineJobs(user?.id || '');

  const filteredJobs = useMemo(() => {
    let result = jobs;
    if (filterMember) {
      result = result.filter((job: any) => job.assigned_to === filterMember);
    }
    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter(job =>
        job.title?.toLowerCase().includes(term) ||
        job.clients?.name?.toLowerCase().includes(term) ||
        job.site_address?.toLowerCase().includes(term)
      );
    }
    return result;
  }, [jobs, search, filterMember]);

  return (
    <MobileLayout>
      <div className="min-h-screen scrollbar-hide">
        {/* Hero Section */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent" />
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

          <div className="relative px-4 pt-8 pb-6">
            <div className="flex items-center gap-2 mb-1">
              <Briefcase className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Job Management</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Jobs</h1>
            <p className="text-muted-foreground mt-1">
              {jobs.length} {jobs.length === 1 ? 'job' : 'jobs'} in your pipeline
            </p>

            {/* Actions */}
            <div className="absolute top-8 right-4 flex items-center gap-3">
              <button
                onClick={() => navigate('/jobs/new')}
                className="p-2.5 rounded-full bg-primary shadow-premium hover:bg-primary/90 transition-all duration-200 hover:scale-105 active:scale-95"
              >
                <Plus className="w-6 h-6 text-primary-foreground" />
              </button>

            </div>
          </div>
        </div>

        <div className="px-4 pb-32 space-y-4">
          {/* Offline indicator */}
          {!isOnline && (
            <div className="flex items-center gap-2 px-4 py-3 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl text-sm text-yellow-600 dark:text-yellow-400 backdrop-blur-sm">
              <WifiOff className="w-4 h-4" />
              <span>Working offline - changes will sync when reconnected</span>
            </div>
          )}

          {/* View Toggle */}
          <div className="flex gap-2 p-1 bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50">
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-sm transition-all duration-300",
                viewMode === 'list'
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:text-foreground hover:bg-primary/5"
              )}
            >
              <List className="w-4 h-4" />
              List
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-sm transition-all duration-300",
                viewMode === 'calendar'
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:text-foreground hover:bg-primary/5"
              )}
            >
              <CalendarDays className="w-4 h-4" />
              Calendar
            </button>
          </div>

          {/* Member Filter */}
          {teamMembers.length > 1 && (
            <Select value={filterMember || 'all'} onValueChange={(v) => setFilterMember(v === 'all' ? '' : v)}>
              <SelectTrigger className="h-10 rounded-xl bg-card/80 border-border/50">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <SelectValue placeholder="All team members" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All team members</SelectItem>
                {teamMembers.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.profiles?.business_name || m.profiles?.email || 'Team member'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

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
              jobs={jobs as any}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              filterMemberId={filterMember || undefined}
            />
          ) : filteredJobs.length === 0 && search ? (
            <EmptyState
              icon={<Briefcase className="w-8 h-8" />}
              title="No matches found"
              description={`No jobs matching "${search}". Try a different search term.`}
            />
          ) : jobs.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-card/50 border border-dashed border-border/50 backdrop-blur-sm">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Briefcase className="w-7 h-7 text-primary" />
              </div>
              <p className="font-semibold text-foreground">No jobs yet!</p>
              <p className="text-sm text-muted-foreground mt-1">Track your jobs from quote to completion</p>
              <Button
                onClick={() => navigate('/jobs/new')}
                className="mt-4 rounded-xl"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Create Job
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredJobs.map((job, index) => (
                <button
                  key={job.id}
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
                      <StatusBadge status={job.status as any} />
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
              ))}
            </div>
          )}
        </div>
      </div>
    </MobileLayout>
  );
}