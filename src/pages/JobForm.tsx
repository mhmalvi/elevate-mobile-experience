import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { UsageLimitBanner, UsageLimitBlocker } from '@/components/UsageLimitBanner';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';

type Client = Tables<'clients'>;

const JOB_STATUSES = [
  { value: 'quoted', label: 'Quoted' },
  { value: 'approved', label: 'Approved' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

export default function JobForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { canCreate, used, limit, tier, isUnlimited, incrementUsage } = useUsageLimits('jobs');
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState({
    client_id: '',
    title: '',
    description: '',
    site_address: '',
    scheduled_date: '',
    status: 'approved',
    notes: '',
  });

  useEffect(() => {
    if (user) fetchClients();
  }, [user]);

  const fetchClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', user?.id)
      .order('name');
    setClients(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Check usage limits
    if (!canCreate) {
      toast({ title: 'Limit reached', description: 'Upgrade your plan to create more jobs', variant: 'destructive' });
      return;
    }

    setLoading(true);
    const { error } = await supabase.from('jobs').insert({
      user_id: user.id,
      client_id: form.client_id || null,
      title: form.title,
      description: form.description,
      site_address: form.site_address,
      scheduled_date: form.scheduled_date || null,
      status: form.status as any,
      notes: form.notes,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      // Increment usage counter
      await incrementUsage();
      toast({ title: 'Job created', description: 'Your job has been saved.' });
      navigate('/jobs');
    }
    setLoading(false);
  };

  // Show blocker if limit reached
  if (!canCreate) {
    return (
      <MobileLayout showNav={false}>
        <PageHeader title="New Job" showBack backPath="/jobs" />
        <UsageLimitBlocker usageType="jobs" tier={tier} />
      </MobileLayout>
    );
  }

  return (
    <MobileLayout showNav={false}>
      <PageHeader title="New Job" showBack backPath="/jobs" />

      <form onSubmit={handleSubmit} className="p-4 space-y-4 animate-fade-in pb-48 safe-bottom scrollbar-hide">
        <UsageLimitBanner usageType="jobs" used={used} limit={limit} tier={tier} isUnlimited={isUnlimited} />
        {/* Client Selection */}
        <div className="space-y-2">
          <Label>Client</Label>
          <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Select a client (optional)" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    {client.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Job Details */}
        <div className="space-y-2">
          <Label htmlFor="title">Job Title *</Label>
          <Input
            id="title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g., Install downlights"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Job details..."
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="site_address">Site Address</Label>
          <Input
            id="site_address"
            value={form.site_address}
            onChange={(e) => setForm({ ...form, site_address: e.target.value })}
            placeholder="123 Main St, Sydney NSW 2000"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="scheduled_date">Scheduled Date</Label>
            <Input
              id="scheduled_date"
              type="date"
              value={form.scheduled_date}
              onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {JOB_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Any additional notes..."
            rows={2}
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Create Job
        </Button>
      </form>
    </MobileLayout>
  );
}
