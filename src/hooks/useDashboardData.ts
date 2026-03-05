import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useTeam } from '@/hooks/useTeam';
import { useProfile } from '@/hooks/useProfile';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DashboardStats {
  monthlyRevenue: number;
  outstandingInvoices: number;
  activeJobs: number;
  pendingQuotes: number;
}

interface OverdueStats {
  count: number;
  total: number;
}

interface RecentQuote {
  id: string;
  title: string;
  status: string;
  created_at: string;
}

interface MemberStats {
  assignedJobs: number;
  completedJobs: number;
  revenue: number;
  completionRate: number;
}

export interface UseDashboardDataReturn {
  /** Authenticated user from useAuth */
  user: ReturnType<typeof useAuth>['user'];
  /** Current team and team-related helpers */
  team: ReturnType<typeof useTeam>['team'];
  allTeams: ReturnType<typeof useTeam>['allTeams'];
  switchTeam: ReturnType<typeof useTeam>['switchTeam'];
  teamMembers: ReturnType<typeof useTeam>['teamMembers'];
  teamLoading: boolean;
  /** Business profile */
  profile: ReturnType<typeof useProfile>['profile'];
  /** Aggregated stats */
  stats: DashboardStats;
  overdueStats: OverdueStats;
  recentActivity: RecentQuote[];
  memberStats: MemberStats | null;
  /** Team member performance filter */
  selectedMember: string;
  setSelectedMember: (id: string) => void;
  /** Reminders */
  sendingReminders: boolean;
  handleSendReminders: () => Promise<void>;
  /** Pull-to-refresh */
  containerProps: { ref: React.RefObject<HTMLDivElement> };
  RefreshIndicator: React.FC;
  /** Greeting text */
  greeting: string;
  timeOfDay: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDashboardData(): UseDashboardDataReturn {
  const { user } = useAuth();
  const { team, allTeams, switchTeam, loading: teamLoading, teamMembers } = useTeam();
  const { profile } = useProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [sendingReminders, setSendingReminders] = useState(false);
  const [selectedMember, setSelectedMember] = useState<string>('');

  const ownershipFilter = team && user
    ? `team_id.eq.${team.id},and(team_id.is.null,user_id.eq.${user.id})`
    : '';

  // -----------------------------------------------------------------------
  // React Query: Dashboard Stats
  // -----------------------------------------------------------------------

  const statsQuery = useQuery({
    queryKey: ['dashboard-stats', user?.id, team?.id],
    queryFn: async () => {
      if (!team || !user) throw new Error('Missing user or team');

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [jobsRes, quotesRes, outstandingRes, paidRes] = await Promise.all([
        supabase
          .from('jobs')
          .select('*', { count: 'exact', head: true })
          .or(ownershipFilter)
          .in('status', ['approved', 'scheduled', 'in_progress']),

        supabase
          .from('quotes')
          .select('*', { count: 'exact', head: true })
          .or(ownershipFilter)
          .in('status', ['sent', 'viewed']),

        supabase
          .from('invoices')
          .select('total, amount_paid')
          .or(ownershipFilter)
          .in('status', ['sent', 'viewed', 'partially_paid', 'overdue']),

        supabase
          .from('invoices')
          .select('amount_paid, paid_at')
          .or(ownershipFilter)
          .eq('status', 'paid')
          .gte('paid_at', startOfMonth),
      ]);

      const outstanding = outstandingRes.data?.reduce((sum, inv) =>
        sum + (Number(inv.total) - Number(inv.amount_paid || 0)), 0) || 0;

      const monthlyRevenue = paidRes.data?.reduce((sum, inv) =>
        sum + Number(inv.amount_paid || 0), 0) || 0;

      return {
        monthlyRevenue,
        outstandingInvoices: outstanding,
        activeJobs: jobsRes.count || 0,
        pendingQuotes: quotesRes.count || 0,
      };
    },
    staleTime: 60_000,
    gcTime: 300_000,
    enabled: !!user && !!team,
  });

  // -----------------------------------------------------------------------
  // React Query: Overdue Invoices
  // -----------------------------------------------------------------------

  const overdueQuery = useQuery({
    queryKey: ['dashboard-overdue', user?.id, team?.id],
    queryFn: async () => {
      if (!team || !user) throw new Error('Missing user or team');

      const today = new Date().toISOString().split('T')[0];

      const { data: overdue } = await supabase
        .from('invoices')
        .select('id, total, amount_paid')
        .or(ownershipFilter)
        .lt('due_date', today)
        .not('status', 'eq', 'paid')
        .not('status', 'eq', 'cancelled');

      if (overdue) {
        const total = overdue.reduce((sum, inv) =>
          sum + (Number(inv.total) - Number(inv.amount_paid || 0)), 0);
        return { count: overdue.length, total };
      }

      return { count: 0, total: 0 };
    },
    staleTime: 60_000,
    gcTime: 300_000,
    enabled: !!user && !!team,
  });

  // -----------------------------------------------------------------------
  // React Query: Recent Activity (Quotes)
  // -----------------------------------------------------------------------

  const activityQuery = useQuery({
    queryKey: ['dashboard-activity', user?.id, team?.id],
    queryFn: async () => {
      if (!team || !user) throw new Error('Missing user or team');

      const { data: quotes } = await supabase
        .from('quotes')
        .select('id, title, status, created_at')
        .or(ownershipFilter)
        .order('created_at', { ascending: false })
        .limit(5);

      return quotes || [];
    },
    staleTime: 60_000,
    gcTime: 300_000,
    enabled: !!user && !!team,
  });

  // -----------------------------------------------------------------------
  // React Query: Member Stats
  // -----------------------------------------------------------------------

  const memberStatsQuery = useQuery({
    queryKey: ['dashboard-member-stats', user?.id, team?.id, selectedMember],
    queryFn: async () => {
      if (!team || !user || !selectedMember) throw new Error('Missing dependencies');

      const [jobsRes, completedRes, memberJobIdsRes] = await Promise.all([
        supabase
          .from('jobs')
          .select('*', { count: 'exact', head: true })
          .or(ownershipFilter)
          .eq('assigned_to', selectedMember),
        supabase
          .from('jobs')
          .select('*', { count: 'exact', head: true })
          .or(ownershipFilter)
          .eq('assigned_to', selectedMember)
          .in('status', ['completed', 'invoiced']),
        supabase
          .from('jobs')
          .select('id')
          .or(ownershipFilter)
          .eq('assigned_to', selectedMember),
      ]);

      const memberJobIds = memberJobIdsRes.data?.map(j => j.id) || [];
      let revenue = 0;
      if (memberJobIds.length > 0) {
        const { data: invoicesData } = await supabase
          .from('invoices')
          .select('total')
          .or(ownershipFilter)
          .eq('status', 'paid')
          .in('job_id', memberJobIds);

        revenue = invoicesData?.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0) || 0;
      }

      const assignedJobs = jobsRes.count || 0;
      const completedJobs = completedRes.count || 0;
      const completionRate = assignedJobs > 0 ? Math.round((completedJobs / assignedJobs) * 100) : 0;

      return { assignedJobs, completedJobs, revenue, completionRate };
    },
    staleTime: 60_000,
    gcTime: 300_000,
    enabled: !!user && !!team && !!selectedMember,
  });

  // -----------------------------------------------------------------------
  // Derived data with defaults
  // -----------------------------------------------------------------------

  const stats: DashboardStats = statsQuery.data ?? {
    monthlyRevenue: 0,
    outstandingInvoices: 0,
    activeJobs: 0,
    pendingQuotes: 0,
  };
  const overdueStats: OverdueStats = overdueQuery.data ?? { count: 0, total: 0 };
  const recentActivity: RecentQuote[] = activityQuery.data ?? [];
  const memberStats: MemberStats | null = memberStatsQuery.data ?? null;

  // -----------------------------------------------------------------------
  // Pull-to-refresh
  // -----------------------------------------------------------------------

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    await queryClient.invalidateQueries({ queryKey: ['dashboard-overdue'] });
    await queryClient.invalidateQueries({ queryKey: ['dashboard-activity'] });
    if (selectedMember) {
      await queryClient.invalidateQueries({ queryKey: ['dashboard-member-stats'] });
    }
  }, [queryClient, selectedMember]);

  const { containerProps, RefreshIndicator } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  // -----------------------------------------------------------------------
  // Send Reminders
  // -----------------------------------------------------------------------

  const handleSendReminders = useCallback(async () => {
    setSendingReminders(true);
    try {
      const { data, error } = await supabase.functions.invoke('payment-reminder', {
        body: { user_id: user?.id, team_id: team?.id },
      });

      if (error) throw error;

      toast({
        title: 'Reminders sent!',
        description: `Payment reminders sent to ${data?.sent || 0} clients`,
      });

      queryClient.invalidateQueries({ queryKey: ['dashboard-overdue', user?.id, team?.id] });
    } catch (err: unknown) {
      console.error('Error sending reminders:', err);
      toast({
        title: 'Failed to send reminders',
        description: err instanceof Error ? err.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setSendingReminders(false);
    }
  }, [user?.id, team?.id, toast, queryClient]);

  // -----------------------------------------------------------------------
  // Greeting
  // -----------------------------------------------------------------------

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const timeOfDay = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  }, []);

  return {
    user,
    team,
    allTeams,
    switchTeam,
    teamMembers,
    teamLoading,
    profile,
    stats,
    overdueStats,
    recentActivity,
    memberStats,
    selectedMember,
    setSelectedMember,
    sendingReminders,
    handleSendReminders,
    containerProps,
    RefreshIndicator,
    greeting,
    timeOfDay,
  };
}
