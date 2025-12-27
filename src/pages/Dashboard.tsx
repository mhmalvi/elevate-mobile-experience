import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { FAB } from '@/components/ui/fab';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, FileText, Briefcase, TrendingUp, Plus, AlertTriangle, Bell, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

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

  return (
    <MobileLayout>
      <PageHeader 
        title={`${greeting()}, ${profile?.business_name || 'Mate'}!`}
        subtitle="Here's how your business is tracking"
        showSettings
      />
      
      <div {...containerProps} className="flex-1 overflow-auto p-4 space-y-6">
        <RefreshIndicator />

        {/* Overdue Invoices Alert */}
        {overdueStats.count > 0 && (
          <div className="animate-fade-in bg-gradient-to-r from-destructive/20 via-destructive/10 to-destructive/5 border border-destructive/30 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-destructive/20">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-destructive">
                  {overdueStats.count} Overdue Invoice{overdueStats.count !== 1 ? 's' : ''}
                </h3>
                <p className="text-2xl font-bold mt-1">
                  ${overdueStats.total.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
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
                className="flex-1"
              >
                <Bell className="w-4 h-4 mr-1" />
                {sendingReminders ? 'Sending...' : 'Send Reminders'}
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => navigate('/invoices')}
                className="flex-1"
              >
                View All
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex gap-3 animate-fade-in">
          <Button 
            onClick={() => navigate('/quotes/new')}
            className="flex-1 h-14"
            variant="premium"
          >
            <Plus className="w-5 h-5" />
            New Quote
          </Button>
          <Button 
            onClick={() => navigate('/jobs/new')}
            variant="outline"
            className="flex-1 h-14"
          >
            <Briefcase className="w-5 h-5" />
            New Job
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="animate-fade-in stagger-1">
            <StatCard
              label="Outstanding"
              value={`$${stats.outstandingInvoices.toLocaleString()}`}
              icon={<DollarSign className="w-5 h-5" />}
              variant="warning"
            />
          </div>
          <div className="animate-fade-in stagger-2">
            <StatCard
              label="Active Jobs"
              value={stats.activeJobs}
              icon={<Briefcase className="w-5 h-5" />}
              variant="primary"
            />
          </div>
          <div className="animate-fade-in stagger-3">
            <StatCard
              label="Pending Quotes"
              value={stats.pendingQuotes}
              icon={<FileText className="w-5 h-5" />}
              variant="default"
            />
          </div>
          <div className="animate-fade-in stagger-4">
            <StatCard
              label="This Month"
              value={`$${stats.monthlyRevenue.toLocaleString()}`}
              icon={<TrendingUp className="w-5 h-5" />}
              variant="success"
            />
          </div>
        </div>

        {/* Recent Activity */}
        <div className="space-y-3 animate-fade-in stagger-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Recent Quotes</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/quotes')}>
              View all
            </Button>
          </div>
          {recentActivity.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-card border">
              <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground font-medium">No quotes yet, mate!</p>
              <p className="text-sm text-muted-foreground mt-1">Create your first quote to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentActivity.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => navigate(`/quotes/${item.id}`)}
                  className="w-full p-4 bg-card rounded-xl border flex items-center justify-between card-interactive animate-fade-in"
                  style={{ animationDelay: `${(index + 6) * 0.05}s` }}
                >
                  <span className="font-semibold text-sm truncate pr-3">{item.title}</span>
                  <StatusBadge status={item.status} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Floating Action Button */}
      <FAB onClick={() => navigate('/quotes/new')} label="New Quote" />
    </MobileLayout>
  );
}
