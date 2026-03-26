import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useTeam } from '@/hooks/useTeam';
import { useTimesheets } from '@/hooks/queries/useTimesheets';
import { TimesheetListItem } from '@/components/list-items';
import {
  Clock,
  Plus,
  ArrowLeft,
} from 'lucide-react';

export default function Timesheets() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { teamMembers, canManageTeam } = useTeam();
  const { data: rawTimesheets = [], isLoading: loading } = useTimesheets();
  const [filterMember, setFilterMember] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Enrich timesheets with member info from teamMembers
  const timesheets = useMemo(() => {
    return rawTimesheets.map(ts => {
      const member = teamMembers.find(m => m.user_id === ts.member_id);
      return {
        ...ts,
        member_email: member?.profiles?.email || '',
        member_name: member?.profiles?.business_name || member?.profiles?.email || 'You',
      };
    });
  }, [rawTimesheets, teamMembers]);

  const filtered = useMemo(() => {
    return timesheets.filter(ts => {
      if (filterMember !== 'all' && ts.member_id !== filterMember) return false;
      if (filterStatus !== 'all' && ts.status !== filterStatus) return false;
      return true;
    });
  }, [timesheets, filterMember, filterStatus]);

  const handleCreateTimesheet = () => {
    navigate('/timesheets/new');
  };

  return (
    <MobileLayout>
      <div className="min-h-screen scrollbar-hide">
        {/* Hero Section */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent" />
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

          <div className="relative px-4 pt-8 pb-6">
            <button
              onClick={() => navigate('/settings')}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium">Back to Settings</span>
            </button>

            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Team</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Timesheets</h1>
            <p className="text-muted-foreground mt-1">
              {timesheets.length} {timesheets.length === 1 ? 'timesheet' : 'timesheets'}
            </p>

            {/* Add Button */}
            <div className="absolute top-8 right-4">
              <button
                onClick={handleCreateTimesheet}
                className="p-2.5 rounded-full bg-primary shadow-premium hover:bg-primary/90 transition-all duration-200 hover:scale-105 active:scale-95"
              >
                <Plus className="w-6 h-6 text-primary-foreground" />
              </button>
            </div>
          </div>
        </div>

        <div className="px-4 pb-32 space-y-4">
          {/* Filters */}
          {timesheets.length > 0 && (
            <div className="flex gap-2">
              {canManageTeam && teamMembers.length > 1 && (
                <Select value={filterMember} onValueChange={setFilterMember}>
                  <SelectTrigger className="flex-1 rounded-xl h-10">
                    <SelectValue placeholder="All Members" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Members</SelectItem>
                    {teamMembers.map(m => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {m.profiles?.business_name || m.profiles?.email || 'Member'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="flex-1 rounded-xl h-10">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {loading ? (
            <ListSkeleton count={5} />
          ) : filtered.length === 0 && (filterMember !== 'all' || filterStatus !== 'all') ? (
            <EmptyState
              icon={<Clock className="w-8 h-8" />}
              title="No matches"
              description="No timesheets match the current filters."
            />
          ) : timesheets.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-card/50 border border-dashed border-border/50 backdrop-blur-sm">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Clock className="w-7 h-7 text-primary" />
              </div>
              <p className="font-semibold text-foreground">No timesheets yet</p>
              <p className="text-sm text-muted-foreground mt-1">Create your first weekly timesheet</p>
              <Button onClick={handleCreateTimesheet} className="mt-4 rounded-xl" size="sm">
                <Plus className="w-4 h-4 mr-1.5" />
                New Timesheet
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((ts, index) => (
                <TimesheetListItem
                  key={ts.id}
                  timesheet={ts}
                  index={index}
                  currentUserId={user?.id}
                  canManageTeam={canManageTeam}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </MobileLayout>
  );
}
