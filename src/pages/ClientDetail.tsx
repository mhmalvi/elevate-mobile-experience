import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/ui/empty-state';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Phone, Mail, MapPin, Edit } from 'lucide-react';
import { format } from 'date-fns';

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [client, setClient] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && id) {
      fetchClient();
      fetchClientHistory();
    }
  }, [user, id]);

  const fetchClient = async () => {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single();
    setClient(data);
    setLoading(false);
  };

  const fetchClientHistory = async () => {
    const [jobsRes, quotesRes, invoicesRes] = await Promise.all([
      supabase.from('jobs').select('*').eq('client_id', id).order('created_at', { ascending: false }),
      supabase.from('quotes').select('*').eq('client_id', id).order('created_at', { ascending: false }),
      supabase.from('invoices').select('*').eq('client_id', id).order('created_at', { ascending: false }),
    ]);
    setJobs(jobsRes.data || []);
    setQuotes(quotesRes.data || []);
    setInvoices(invoicesRes.data || []);
  };

  const handleDelete = async () => {
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Client deleted' });
      navigate('/clients');
    }
  };

  // Calculate total revenue from this client
  const totalRevenue = invoices
    .filter(inv => inv.status === 'paid')
    .reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);

  const outstandingAmount = invoices
    .filter(inv => ['sent', 'viewed', 'partially_paid', 'overdue'].includes(inv.status))
    .reduce((sum, inv) => sum + (Number(inv.total) - Number(inv.amount_paid || 0)), 0);

  if (loading || !client) {
    return (
      <MobileLayout showNav={false}>
        <PageHeader title="Client" showBack backPath="/clients" />
        <div className="p-4 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout showNav={false}>
      <PageHeader
        title={client.name}
        showBack
        backPath="/clients"
        action={{
          label: 'Edit',
          onClick: () => navigate(`/clients/${id}/edit`),
          icon: <Edit className="w-4 h-4" />
        }}
      />

      <div className="p-4 space-y-6 animate-fade-in pb-48 safe-bottom">
        {/* Profile Card */}
        <div className="flex flex-col items-center py-6 px-4 bg-card/40 backdrop-blur-md rounded-[2.5rem] border border-border/40 shadow-premium relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 bg-primary/10 rounded-full blur-2xl" />
          <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center shadow-glow mb-4">
            <span className="text-3xl font-black text-primary-foreground">{client.name.charAt(0).toUpperCase()}</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight">{client.name}</h2>
          <div className="flex items-center gap-2 mt-2">
            <StatusBadge status="active" />
          </div>
        </div>

        {/* Contact Links Grid */}
        <div className="grid grid-cols-2 gap-3">
          {client.phone && (
            <Button asChild variant="outline" className="h-16 rounded-2xl bg-card/30 backdrop-blur-md border-border/40 shadow-sm">
              <a href={`tel:${client.phone}`}>
                <Phone className="w-5 h-5 mr-3 text-primary" />
                <span className="font-bold">Call</span>
              </a>
            </Button>
          )}
          {client.email && (
            <Button asChild variant="outline" className="h-16 rounded-2xl bg-card/30 backdrop-blur-md border-border/40 shadow-sm">
              <a href={`mailto:${client.email}`}>
                <Mail className="w-5 h-5 mr-3 text-primary" />
                <span className="font-bold">Email</span>
              </a>
            </Button>
          )}
        </div>

        {/* Core Info List */}
        <div className="p-5 bg-card/40 backdrop-blur-md rounded-2xl border border-border/40 space-y-4 shadow-sm">
          {client.email && (
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-muted-foreground/60" />
              <span className="text-sm font-medium">{client.email}</span>
            </div>
          )}
          {client.phone && (
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-muted-foreground/60" />
              <span className="text-sm font-medium">{client.phone}</span>
            </div>
          )}
          {(client.address || client.suburb) && (
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-muted-foreground/60 mt-0.5" />
              <div className="text-sm font-medium">
                {client.address && <p>{client.address}</p>}
                {client.suburb && <p>{client.suburb}, {client.state} {client.postcode}</p>}
              </div>
            </div>
          )}
        </div>

        {/* Revenue Dashboard */}
        {(totalRevenue > 0 || outstandingAmount > 0) && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <div className="w-1.5 h-6 bg-primary rounded-full" />
              <h3 className="font-bold text-lg text-foreground">Client Value</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-success/5 border border-success/20 rounded-2xl overflow-hidden relative group">
                <div className="absolute -bottom-4 -right-4 w-12 h-12 bg-success/10 rounded-full blur-xl group-hover:scale-150 transition-transform" />
                <p className="text-[10px] font-black uppercase tracking-widest text-success/60 mb-1">Lifetime</p>
                <p className="text-2xl font-black text-success tracking-tight">${totalRevenue.toLocaleString()}</p>
              </div>
              <div className="p-4 bg-warning/5 border border-warning/20 rounded-2xl overflow-hidden relative group">
                <div className="absolute -bottom-4 -right-4 w-12 h-12 bg-warning/10 rounded-full blur-xl group-hover:scale-150 transition-transform" />
                <p className="text-[10px] font-black uppercase tracking-widest text-warning/60 mb-1">Due</p>
                <p className="text-2xl font-black text-warning tracking-tight">${outstandingAmount.toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}

        {/* History Section Tabs */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <div className="w-1.5 h-6 bg-primary rounded-full" />
            <h3 className="font-bold text-lg text-foreground">History</h3>
          </div>

          <Tabs defaultValue="quotes" className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-12 bg-muted/20 p-1 rounded-xl">
              <TabsTrigger value="quotes" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <span className="text-[10px] font-bold">QUOTES</span>
              </TabsTrigger>
              <TabsTrigger value="jobs" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <span className="text-[10px] font-bold">JOBS</span>
              </TabsTrigger>
              <TabsTrigger value="invoices" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <span className="text-[10px] font-bold">INVOICES</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="quotes" className="mt-4 space-y-3">
              {quotes.length === 0 ? (
                <EmptyState variant="minimal" title="No quotes" description="Ready for a new project?" />
              ) : (
                quotes.map((quote) => (
                  <button
                    key={quote.id}
                    onClick={() => navigate(`/quotes/${quote.id}`)}
                    className="w-full p-4 bg-card/60 backdrop-blur-sm rounded-2xl border border-border/40 text-left shadow-sm flex items-center justify-between hover:bg-card/80 transition-all active:scale-[0.98]"
                  >
                    <div className="min-w-0 flex-1 pr-4">
                      <p className="font-bold text-foreground truncate mb-0.5">{quote.title}</p>
                      <p className="text-xs text-muted-foreground font-medium">
                        {format(new Date(quote.created_at), 'd MMM yyyy')} • ${Number(quote.total).toLocaleString()}
                      </p>
                    </div>
                    <StatusBadge status={quote.status} />
                  </button>
                ))
              )}
            </TabsContent>

            <TabsContent value="jobs" className="mt-4 space-y-3">
              {jobs.length === 0 ? (
                <EmptyState variant="minimal" title="No jobs" description="History starts here" />
              ) : (
                jobs.map((job) => (
                  <button
                    key={job.id}
                    onClick={() => navigate(`/jobs/${job.id}`)}
                    className="w-full p-4 bg-card/60 backdrop-blur-sm rounded-2xl border border-border/40 text-left shadow-sm flex items-center justify-between hover:bg-card/80 transition-all active:scale-[0.98]"
                  >
                    <div className="min-w-0 flex-1 pr-4">
                      <p className="font-bold text-foreground truncate mb-0.5">{job.title}</p>
                      <p className="text-xs text-muted-foreground font-medium">
                        {job.scheduled_date ? format(new Date(job.scheduled_date), 'd MMM yyyy') : 'Draft'}
                      </p>
                    </div>
                    <StatusBadge status={job.status} />
                  </button>
                ))
              )}
            </TabsContent>

            <TabsContent value="invoices" className="mt-4 space-y-3">
              {invoices.length === 0 ? (
                <EmptyState variant="minimal" title="No invoices" description="No financial history" />
              ) : (
                invoices.map((invoice) => (
                  <button
                    key={invoice.id}
                    onClick={() => navigate(`/invoices/${invoice.id}`)}
                    className="w-full p-4 bg-card/60 backdrop-blur-sm rounded-2xl border border-border/40 text-left shadow-sm flex items-center justify-between hover:bg-card/80 transition-all active:scale-[0.98]"
                  >
                    <div className="min-w-0 flex-1 pr-4">
                      <p className="font-bold text-foreground truncate mb-0.5">{invoice.invoice_number}</p>
                      <p className="text-xs text-muted-foreground font-medium">
                        {format(new Date(invoice.created_at), 'd MMM yyyy')} • ${Number(invoice.total).toLocaleString()}
                      </p>
                    </div>
                    <StatusBadge status={invoice.status || 'draft'} />
                  </button>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Danger Zone */}
        <div className="pt-6">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="w-full text-destructive/40 hover:text-destructive hover:bg-destructive/10 h-10 text-[10px] font-black uppercase tracking-[0.2em]">
                Remove Client Record
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this client?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. All documents related to this client will lose their connection.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground rounded-xl">Confirm Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </MobileLayout>
  );
}