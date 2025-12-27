import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, FileText, Briefcase, Clock } from 'lucide-react';

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

  useEffect(() => {
    if (user) {
      fetchStats();
      fetchRecentActivity();
    }
  }, [user]);

  const fetchStats = async () => {
    // Fetch active jobs count
    const { count: jobsCount } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user?.id)
      .in('status', ['approved', 'scheduled', 'in_progress']);

    // Fetch pending quotes count
    const { count: quotesCount } = await supabase
      .from('quotes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user?.id)
      .in('status', ['sent', 'viewed']);

    // Fetch outstanding invoices
    const { data: invoices } = await supabase
      .from('invoices')
      .select('total, amount_paid')
      .eq('user_id', user?.id)
      .in('status', ['sent', 'viewed', 'partially_paid', 'overdue']);

    const outstanding = invoices?.reduce((sum, inv) => 
      sum + (Number(inv.total) - Number(inv.amount_paid)), 0) || 0;

    setStats({
      monthlyRevenue: 0,
      outstandingInvoices: outstanding,
      activeJobs: jobsCount || 0,
      pendingQuotes: quotesCount || 0,
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
        subtitle="Here's your business overview"
      />
      
      <div className="p-4 space-y-6 animate-fade-in">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Outstanding"
            value={`$${stats.outstandingInvoices.toLocaleString()}`}
            icon={<DollarSign className="w-5 h-5" />}
            variant="warning"
          />
          <StatCard
            label="Active Jobs"
            value={stats.activeJobs}
            icon={<Briefcase className="w-5 h-5" />}
            variant="primary"
          />
          <StatCard
            label="Pending Quotes"
            value={stats.pendingQuotes}
            icon={<FileText className="w-5 h-5" />}
            variant="default"
          />
          <StatCard
            label="This Month"
            value={`$${stats.monthlyRevenue.toLocaleString()}`}
            icon={<Clock className="w-5 h-5" />}
            variant="success"
          />
        </div>

        {/* Recent Activity */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Recent Quotes</h2>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No quotes yet. Create your first quote!
            </p>
          ) : (
            <div className="space-y-2">
              {recentActivity.map((item) => (
                <button
                  key={item.id}
                  onClick={() => navigate(`/quotes/${item.id}`)}
                  className="w-full p-3 bg-card rounded-lg border flex items-center justify-between hover:bg-muted/50 transition-smooth"
                >
                  <span className="font-medium text-sm truncate">{item.title}</span>
                  <StatusBadge status={item.status} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </MobileLayout>
  );
}
