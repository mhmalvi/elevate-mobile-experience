import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { supabase } from '@/integrations/supabase/client';
import {
  DollarSign,
  FileText,
  Briefcase,
  TrendingUp,
  Plus,
  AlertTriangle,
  Bell,
  ChevronRight,
  Sparkles,
  Clock,
  CheckCircle2,
  ArrowUpRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { toast } = useToast();
  const [stats, setStats] = useState({
    monthlyRevenue: 0,
    outstandingInvoices: 0,
    activeJobs: 0,
    pendingQuotes: 0,
  });
  const [overdueStats, setOverdueStats] = useState({ count: 0, total: 0 });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [sendingReminders, setSendingReminders] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    await Promise.all([fetchStats(), fetchRecentActivity(), fetchOverdueInvoices()]);
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchStats();
      fetchRecentActivity();
      fetchOverdueInvoices();
    }
  }, [user]);

  const { containerProps, RefreshIndicator } = usePullToRefresh({
    onRefresh: fetchData,
  });

  const fetchStats = async () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [jobsRes, quotesRes, outstandingRes, paidRes] = await Promise.all([
      supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id)
        .in('status', ['approved', 'scheduled', 'in_progress']),

      supabase
        .from('quotes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id)
        .in('status', ['sent', 'viewed']),

      supabase
        .from('invoices')
        .select('total, amount_paid')
        .eq('user_id', user?.id)
        .in('status', ['sent', 'viewed', 'partially_paid', 'overdue']),

      supabase
        .from('invoices')
        .select('amount_paid, paid_at')
        .eq('user_id', user?.id)
        .eq('status', 'paid')
        .gte('paid_at', startOfMonth),
    ]);

    const outstanding = outstandingRes.data?.reduce((sum, inv) =>
      sum + (Number(inv.total) - Number(inv.amount_paid || 0)), 0) || 0;

    const monthlyRevenue = paidRes.data?.reduce((sum, inv) =>
      sum + Number(inv.amount_paid || 0), 0) || 0;

    setStats({
      monthlyRevenue,
      outstandingInvoices: outstanding,
      activeJobs: jobsRes.count || 0,
      pendingQuotes: quotesRes.count || 0,
    });
  };

  const fetchOverdueInvoices = async () => {
    const today = new Date().toISOString().split('T')[0];

    const { data: overdue } = await supabase
      .from('invoices')
      .select('id, total, amount_paid')
      .eq('user_id', user?.id)
      .lt('due_date', today)
      .not('status', 'eq', 'paid')
      .not('status', 'eq', 'cancelled');

    if (overdue) {
      const total = overdue.reduce((sum, inv) =>
        sum + (Number(inv.total) - Number(inv.amount_paid || 0)), 0);
      setOverdueStats({ count: overdue.length, total });
    }
  };

  const fetchRecentActivity = async () => {
    const { data: quotes } = await supabase
      .from('quotes')
      .select('id, title, status, created_at')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false })
      .limit(5);

    setRecentActivity(quotes || []);
  };

  const handleSendReminders = async () => {
    setSendingReminders(true);
    try {
      const { data, error } = await supabase.functions.invoke('payment-reminder', {
        body: { user_id: user?.id }
      });

      if (error) throw error;

      toast({
        title: 'Reminders sent!',
        description: `Payment reminders sent to ${data?.sent || 0} clients`,
      });

      fetchOverdueInvoices();
    } catch (error: any) {
      console.error('Error sending reminders:', error);
      toast({
        title: 'Failed to send reminders',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setSendingReminders(false);
    }
  };

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "G'day";
    if (hour < 17) return "Good arvo";
    return "Evening";
  };

  const getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "morning";
    if (hour < 17) return "afternoon";
    return "evening";
  };

  return (
    <MobileLayout>
      <div {...containerProps} className="min-h-screen scrollbar-hide">
        <RefreshIndicator />

        {/* Hero Section with Gradient */}
        <div className="relative overflow-hidden">
          {/* Background Gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

          <div className="relative px-4 pt-8 pb-6">
            {/* Greeting */}
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-primary animate-pulse" />
              <span className="text-sm font-medium text-primary">Welcome back</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground">
              {greeting()}, {profile?.business_name || 'Mate'}!
            </h1>
            <p className="text-muted-foreground mt-1">
              Here's your business snapshot this {getTimeOfDay()}
            </p>

            {/* Settings Button */}

          </div>
        </div>

        <div className="px-4 pb-32 space-y-6">
          {/* Overdue Invoices Alert */}
          {overdueStats.count > 0 && (
            <div className="animate-fade-in bg-gradient-to-r from-destructive/20 via-destructive/10 to-transparent border border-destructive/30 rounded-2xl p-4 space-y-3 backdrop-blur-sm">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-destructive/20 shrink-0">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-destructive">
                    {overdueStats.count} Overdue Invoice{overdueStats.count !== 1 ? 's' : ''}
                  </h3>
                  <p className="text-2xl font-bold mt-1 text-foreground">
                    ${overdueStats.total.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Outstanding payments past due date
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleSendReminders}
                  disabled={sendingReminders}
                  className="flex-1 rounded-xl h-10"
                >
                  <Bell className="w-4 h-4 mr-1.5" />
                  {sendingReminders ? 'Sending...' : 'Send Reminders'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate('/invoices')}
                  className="flex-1 rounded-xl h-10"
                >
                  View All
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="animate-fade-in">
            <div className="flex items-center gap-2 mb-3">
              <Plus className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-foreground">Quick Actions</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => navigate('/quotes/new')}
                className="group relative overflow-hidden p-4 rounded-2xl bg-gradient-to-br from-primary via-primary to-primary-hover text-primary-foreground transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-glow"
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <FileText className="w-5 h-5" />
                  </div>
                  <p className="font-bold text-left">New Quote</p>
                  <p className="text-xs text-primary-foreground/70 text-left mt-0.5">Create professional quote</p>
                </div>
                <ArrowUpRight className="absolute top-3 right-3 w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
              </button>

              <button
                onClick={() => navigate('/jobs/new')}
                className="group relative overflow-hidden p-4 rounded-2xl bg-card border border-border/50 hover:border-primary/30 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] hover:shadow-lg"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-primary/20 transition-all">
                  <Briefcase className="w-5 h-5 text-primary" />
                </div>
                <p className="font-bold text-left text-foreground">New Job</p>
                <p className="text-xs text-muted-foreground text-left mt-0.5">Schedule a new job</p>
                <ArrowUpRight className="absolute top-3 right-3 w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="animate-fade-in">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-foreground">Business Overview</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
                <StatCard
                  label="Outstanding"
                  value={`$${stats.outstandingInvoices.toLocaleString()}`}
                  icon={<DollarSign className="w-5 h-5" />}
                  variant="warning"
                />
              </div>
              <div className="animate-fade-in" style={{ animationDelay: '0.15s' }}>
                <StatCard
                  label="Active Jobs"
                  value={stats.activeJobs}
                  icon={<Briefcase className="w-5 h-5" />}
                  variant="primary"
                />
              </div>
              <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
                <StatCard
                  label="Pending Quotes"
                  value={stats.pendingQuotes}
                  icon={<FileText className="w-5 h-5" />}
                  variant="default"
                />
              </div>
              <div className="animate-fade-in" style={{ animationDelay: '0.25s' }}>
                <StatCard
                  label="This Month"
                  value={`$${stats.monthlyRevenue.toLocaleString()}`}
                  icon={<TrendingUp className="w-5 h-5" />}
                  variant="success"
                />
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <h2 className="font-semibold text-foreground">Recent Quotes</h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/quotes')}
                className="text-primary hover:text-primary/80 hover:bg-primary/5 -mr-2"
              >
                View all
                <ChevronRight className="w-4 h-4 ml-0.5" />
              </Button>
            </div>

            {recentActivity.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-card/50 border border-dashed border-border/50 backdrop-blur-sm">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <FileText className="w-7 h-7 text-primary" />
                </div>
                <p className="font-semibold text-foreground">No quotes yet, mate!</p>
                <p className="text-sm text-muted-foreground mt-1">Create your first quote to get started</p>
                <Button
                  onClick={() => navigate('/quotes/new')}
                  className="mt-4 rounded-xl"
                  size="sm"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Create Quote
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {recentActivity.map((item, index) => (
                  <button
                    key={item.id}
                    onClick={() => navigate(`/quotes/${item.id}`)}
                    className={cn(
                      "w-full p-4 bg-card/80 backdrop-blur-sm rounded-xl border border-border/50",
                      "flex items-center justify-between",
                      "hover:bg-card hover:border-primary/20 hover:shadow-md",
                      "transition-all duration-300 group animate-fade-in"
                    )}
                    style={{ animationDelay: `${0.35 + index * 0.05}s` }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
                        <FileText className="w-4 h-4 text-primary" />
                      </div>
                      <span className="font-semibold text-sm truncate text-foreground">{item.title}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={item.status} />
                      <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Pro Tip Card */}
          <div className="animate-fade-in p-4 rounded-2xl bg-gradient-to-br from-secondary/20 via-secondary/10 to-transparent border border-secondary/30 backdrop-blur-sm" style={{ animationDelay: '0.5s' }}>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-secondary/20 shrink-0">
                <CheckCircle2 className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <h3 className="font-bold text-secondary">Pro Tip</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Use the voice button at the bottom to quickly create quotes and manage your jobs hands-free!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MobileLayout>
  );
}
