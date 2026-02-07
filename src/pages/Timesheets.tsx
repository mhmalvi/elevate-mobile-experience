import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useTeam } from '@/hooks/useTeam';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Clock,
  Plus,
  ArrowLeft,
  Calendar,
  User,
  ChevronRight,
  CheckCircle2,
  Send,
  FileEdit,
  XCircle,
} from 'lucide-react';
import { format, startOfWeek, addDays, parseISO, isThisWeek } from 'date-fns';

interface Timesheet {
  id: string;
  user_id: string;
  team_id: string | null;
  member_id: string;
  week_starting: string;
  status: string;
  total_hours: number;
  notes: string | null;
  approved_by: string | null;
  approved_at: string | null;
  submitted_at: string | null;
  created_at: string;
  member_email?: string;
  member_name?: string;
}

const statusConfig: Record<string, { icon: any; color: string }> = {
  draft: { icon: FileEdit, color: 'text-muted-foreground' },
  submitted: { icon: Send, color: 'text-blue-500' },
  approved: { icon: CheckCircle2, color: 'text-green-500' },
  rejected: { icon: XCircle, color: 'text-destructive' },
};

export default function Timesheets() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { team, teamMembers, canManageTeam } = useTeam();
  const { toast } = useToast();
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMember, setFilterMember] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    if (user) fetchTimesheets();
  }, [user]);

  const fetchTimesheets = async () => {
    const { data, error } = await (supabase as any)
      .from('timesheets')
      .select('*')
      .or(`user_id.eq.${user?.id},member_id.eq.${user?.id}`)
      .order('week_starting', { ascending: false });

    if (error) {
      console.error('Error fetching timesheets:', error);
      toast({ title: 'Error loading timesheets', description: error.message, variant: 'destructive' });
    } else {
      // Enrich with member info from teamMembers
      const enriched = (data || []).map((ts: Timesheet) => {
        const member = teamMembers.find(m => m.user_id === ts.member_id);
        return {
          ...ts,
          member_email: member?.profiles?.email || '',
          member_name: member?.profiles?.business_name || member?.profiles?.email || 'You',
        };
      });
      setTimesheets(enriched);
    }
    setLoading(false);
  };

  // Re-enrich when teamMembers load
  useEffect(() => {
    if (teamMembers.length > 0 && timesheets.length > 0) {
      setTimesheets(prev => prev.map(ts => {
        const member = teamMembers.find(m => m.user_id === ts.member_id);
        return {
          ...ts,
          member_email: member?.profiles?.email || '',
          member_name: member?.profiles?.business_name || member?.profiles?.email || 'You',
        };
      }));
    }
  }, [teamMembers]);

  const filtered = useMemo(() => {
    return timesheets.filter(ts => {
      if (filterMember !== 'all' && ts.member_id !== filterMember) return false;
      if (filterStatus !== 'all' && ts.status !== filterStatus) return false;
      return true;
    });
  }, [timesheets, filterMember, filterStatus]);

  const handleCreateTimesheet = async () => {
    if (!user) return;
    // Calculate current week's Monday
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekStr = format(monday, 'yyyy-MM-dd');

    // Check if one already exists for this week
    const existing = timesheets.find(
      ts => ts.member_id === user.id && ts.week_starting === weekStr
    );
    if (existing) {
      navigate(`/timesheets/${existing.id}`);
      return;
    }

    // Create new timesheet
    const { data, error } = await (supabase as any).from('timesheets').insert({
      user_id: user.id,
      team_id: team?.id || null,
      member_id: user.id,
      week_starting: weekStr,
      status: 'draft',
      total_hours: 0,
    }).select().single();

    if (error) {
      toast({ title: 'Error creating timesheet', description: error.message, variant: 'destructive' });
    } else {
      navigate(`/timesheets/${data.id}`);
    }
  };

  const formatWeekRange = (weekStarting: string) => {
    const start = parseISO(weekStarting);
    const end = addDays(start, 6);
    return `${format(start, 'dd MMM')} - ${format(end, 'dd MMM yyyy')}`;
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
              {filtered.map((ts, index) => {
                const StatusIcon = statusConfig[ts.status]?.icon || FileEdit;
                const statusColor = statusConfig[ts.status]?.color || 'text-muted-foreground';
                const isCurrent = isThisWeek(parseISO(ts.week_starting), { weekStartsOn: 1 });

                return (
                  <button
                    key={ts.id}
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
                          {canManageTeam && ts.member_id !== user?.id && (
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
              })}
            </div>
          )}
        </div>
      </div>
    </MobileLayout>
  );
}
