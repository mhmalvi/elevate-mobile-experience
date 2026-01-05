import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Phone, Mail, MapPin, Edit, Trash2, FileText, Briefcase, Receipt } from 'lucide-react';
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
      
      <div className="p-4 space-y-6 animate-fade-in pb-32">
        {/* Contact Info */}
        <div className="p-4 bg-card rounded-xl border space-y-3">
          {client.phone && (
            <a 
              href={`tel:${client.phone}`}
              className="flex items-center gap-3 text-sm hover:text-primary transition-colors"
            >
              <Phone className="w-4 h-4 text-muted-foreground" />
              {client.phone}
            </a>
          )}
          {client.email && (
            <a 
              href={`mailto:${client.email}`}
              className="flex items-center gap-3 text-sm hover:text-primary transition-colors"
            >
              <Mail className="w-4 h-4 text-muted-foreground" />
              {client.email}
            </a>
          )}
          {(client.address || client.suburb) && (
            <div className="flex items-start gap-3 text-sm">
              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                {client.address && <p>{client.address}</p>}
                {client.suburb && <p>{client.suburb}, {client.state} {client.postcode}</p>}
              </div>
            </div>
          )}
        </div>

        {/* Revenue Summary */}
        {(totalRevenue > 0 || outstandingAmount > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 bg-success/10 border border-success/30 rounded-xl text-center">
              <p className="text-xs text-muted-foreground mb-1">Total Revenue</p>
              <p className="text-lg font-bold text-success">${totalRevenue.toLocaleString()}</p>
            </div>
            <div className="p-4 bg-warning/10 border border-warning/30 rounded-xl text-center">
              <p className="text-xs text-muted-foreground mb-1">Outstanding</p>
              <p className="text-lg font-bold text-warning">${outstandingAmount.toLocaleString()}</p>
            </div>
          </div>
        )}

        {/* Notes */}
        {client.notes && (
          <div className="space-y-2">
            <h3 className="font-semibold">Notes</h3>
            <p className="text-sm text-muted-foreground">{client.notes}</p>
          </div>
        )}

        {/* History Tabs */}
        <Tabs defaultValue="quotes" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="quotes" className="text-xs">
              <FileText className="w-3 h-3 mr-1" />
              Quotes ({quotes.length})
            </TabsTrigger>
            <TabsTrigger value="jobs" className="text-xs">
              <Briefcase className="w-3 h-3 mr-1" />
              Jobs ({jobs.length})
            </TabsTrigger>
            <TabsTrigger value="invoices" className="text-xs">
              <Receipt className="w-3 h-3 mr-1" />
              Invoices ({invoices.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="quotes" className="mt-4 space-y-2">
            {quotes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No quotes yet</p>
            ) : (
              quotes.map((quote) => (
                <button
                  key={quote.id}
                  onClick={() => navigate(`/quotes/${quote.id}`)}
                  className="w-full p-3 bg-card rounded-lg border text-left text-sm flex items-center justify-between card-interactive"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{quote.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(quote.created_at), 'd MMM yyyy')} • ${Number(quote.total).toLocaleString()}
                    </p>
                  </div>
                  <StatusBadge status={quote.status} />
                </button>
              ))
            )}
          </TabsContent>

          <TabsContent value="jobs" className="mt-4 space-y-2">
            {jobs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No jobs yet</p>
            ) : (
              jobs.map((job) => (
                <button
                  key={job.id}
                  onClick={() => navigate(`/jobs/${job.id}`)}
                  className="w-full p-3 bg-card rounded-lg border text-left text-sm flex items-center justify-between card-interactive"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{job.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {job.scheduled_date ? format(new Date(job.scheduled_date), 'd MMM yyyy') : 'Not scheduled'}
                    </p>
                  </div>
                  <StatusBadge status={job.status} />
                </button>
              ))
            )}
          </TabsContent>

          <TabsContent value="invoices" className="mt-4 space-y-2">
            {invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No invoices yet</p>
            ) : (
              invoices.map((invoice) => (
                <button
                  key={invoice.id}
                  onClick={() => navigate(`/invoices/${invoice.id}`)}
                  className="w-full p-3 bg-card rounded-lg border text-left text-sm flex items-center justify-between card-interactive"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{invoice.invoice_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(invoice.created_at), 'd MMM yyyy')} • ${Number(invoice.total).toLocaleString()}
                    </p>
                  </div>
                  <StatusBadge status={invoice.status || 'draft'} />
                </button>
              ))
            )}
          </TabsContent>
        </Tabs>

        {/* Delete Button with Confirmation */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              className="w-full text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Client
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this client?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This client and all their data will be permanently deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MobileLayout>
  );
}