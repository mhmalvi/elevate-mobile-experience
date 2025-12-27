import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { User, MapPin, Calendar, Receipt } from 'lucide-react';
import { format } from 'date-fns';

const JOB_STATUSES = ['quoted', 'approved', 'scheduled', 'in_progress', 'completed', 'invoiced'] as const;

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && id) {
      fetchJob();
    }
  }, [user, id]);

  const fetchJob = async () => {
    const { data } = await supabase
      .from('jobs')
      .select('*, clients(name, email, phone), quotes(quote_number, total)')
      .eq('id', id)
      .single();
    setJob(data);
    setLoading(false);
  };

  const updateStatus = async (status: string) => {
    const updates: any = { status };
    if (status === 'completed') updates.completed_at = new Date().toISOString();

    const { error } = await supabase.from('jobs').update(updates).eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Status updated' });
      fetchJob();
    }
  };

  const createInvoice = async () => {
    if (!job) return;
    
    const invoiceNumber = `INV${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    const total = job.quotes?.total || 0;
    const subtotal = total / 1.1;
    const gst = total - subtotal;
    
    const { data: invoice, error } = await supabase.from('invoices').insert({
      user_id: user?.id,
      client_id: job.client_id,
      job_id: job.id,
      quote_id: job.quote_id,
      invoice_number: invoiceNumber,
      title: job.title,
      description: job.description,
      subtotal,
      gst,
      total,
      status: 'draft',
    }).select().single();

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      await updateStatus('invoiced');
      toast({ title: 'Invoice created' });
      navigate(`/invoices/${invoice.id}`);
    }
  };

  if (loading || !job) {
    return (
      <MobileLayout showNav={false}>
        <PageHeader title="Job" showBack backPath="/jobs" />
        <div className="p-4 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout showNav={false}>
      <PageHeader title="Job Details" showBack backPath="/jobs" />
      
      <div className="p-4 space-y-6 animate-fade-in">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">{job.title}</h2>
            <StatusBadge status={job.status} />
          </div>
          {job.clients && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="w-4 h-4" />
              {job.clients.name}
            </div>
          )}
        </div>

        {/* Status Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Status</label>
          <Select value={job.status} onValueChange={updateStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {JOB_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Details */}
        <div className="p-4 bg-card rounded-xl border space-y-3">
          {job.site_address && (
            <div className="flex items-start gap-3 text-sm">
              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
              {job.site_address}
            </div>
          )}
          {job.scheduled_date && (
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              {format(new Date(job.scheduled_date), 'EEEE, d MMMM yyyy')}
            </div>
          )}
          {job.quotes && (
            <div className="flex items-center gap-3 text-sm">
              <Receipt className="w-4 h-4 text-muted-foreground" />
              Quote {job.quotes.quote_number} - ${Number(job.quotes.total).toLocaleString()}
            </div>
          )}
        </div>

        {/* Description */}
        {job.description && (
          <div className="space-y-2">
            <h3 className="font-semibold">Description</h3>
            <p className="text-sm text-muted-foreground">{job.description}</p>
          </div>
        )}

        {/* Notes */}
        {job.notes && (
          <div className="space-y-2">
            <h3 className="font-semibold">Notes</h3>
            <p className="text-sm text-muted-foreground">{job.notes}</p>
          </div>
        )}

        {/* Actions */}
        {job.status === 'completed' && (
          <Button onClick={createInvoice} className="w-full">
            <Receipt className="w-4 h-4 mr-2" />
            Create Invoice
          </Button>
        )}
      </div>
    </MobileLayout>
  );
}
