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
import { DollarSign, FileText, Briefcase, TrendingUp, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const [stats, setStats] = useState({
    monthlyRevenue: 0,
    outstandingInvoices: 0,
    activeJobs: 0,
    pendingQuotes: 0,
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    await Promise.all([fetchStats(), fetchRecentActivity()]);
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchStats();
      fetchRecentActivity();
    }
  }, [user]);

  const { containerProps, RefreshIndicator } = usePullToRefresh({
    onRefresh: fetchData,
  });

  const fetchStats = async () => {
    // Get start of current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [jobsRes, quotesRes, outstandingRes, paidRes] = await Promise.all([
      // Active jobs count
      supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id)
        .in('status', ['approved', 'scheduled', 'in_progress']),
      
      // Pending quotes count
      supabase
        .from('quotes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id)
        .in('status', ['sent', 'viewed']),
      
      // Outstanding invoices (unpaid amounts)
      supabase
        .from('invoices')
        .select('total, amount_paid')
        .eq('user_id', user?.id)
        .in('status', ['sent', 'viewed', 'partially_paid', 'overdue']),
      
      // Monthly revenue (paid invoices this month)
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

  const fetchRecentActivity = async () => {
    const { data: quotes } = await supabase
      .from('quotes')
      .select('id, title, status, created_at')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false })
      .limit(5);

    setRecentActivity(quotes || []);
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