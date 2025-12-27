import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Briefcase, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export default function Jobs() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
      
      <div className="p-4 animate-fade-in">
        {jobs.length === 0 && !loading ? (
          <EmptyState
            icon={<Briefcase className="w-8 h-8" />}
            title="No jobs yet"
            description="Track your jobs from quote to completion."
            action={{
              label: "Create Job",
              onClick: () => navigate('/jobs/new'),
            }}
          />
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => (
              <button
                key={job.id}
                onClick={() => navigate(`/jobs/${job.id}`)}
                className="w-full p-4 bg-card rounded-xl border text-left hover:bg-muted/50 transition-smooth"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{job.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {job.clients?.name || 'No client'}
                    </p>
                  </div>
                  <StatusBadge status={job.status} />
                </div>
                {job.scheduled_date && (
                  <div className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5" />
                    {format(new Date(job.scheduled_date), 'EEE, d MMM')}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
