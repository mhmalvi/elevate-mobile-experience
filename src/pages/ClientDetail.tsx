import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Phone, Mail, MapPin, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [client, setClient] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
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
    const [jobsRes, quotesRes] = await Promise.all([
      supabase.from('jobs').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(5),
      supabase.from('quotes').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(5),
    ]);
    setJobs(jobsRes.data || []);
    setQuotes(quotesRes.data || []);
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this client?')) return;
    
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Client deleted' });
      navigate('/clients');
    }
  };

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
      
      <div className="p-4 space-y-6 animate-fade-in">
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

        {/* Notes */}
        {client.notes && (
          <div className="space-y-2">
            <h3 className="font-semibold">Notes</h3>
            <p className="text-sm text-muted-foreground">{client.notes}</p>
          </div>
        )}

        {/* Recent Quotes */}
        {quotes.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold">Recent Quotes</h3>
            <div className="space-y-2">
              {quotes.map((quote) => (
                <button
                  key={quote.id}
                  onClick={() => navigate(`/quotes/${quote.id}`)}
                  className="w-full p-3 bg-card rounded-lg border text-left text-sm flex items-center justify-between"
                >
                  <span className="truncate">{quote.title}</span>
                  <StatusBadge status={quote.status} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recent Jobs */}
        {jobs.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold">Recent Jobs</h3>
            <div className="space-y-2">
              {jobs.map((job) => (
                <button
                  key={job.id}
                  onClick={() => navigate(`/jobs/${job.id}`)}
                  className="w-full p-3 bg-card rounded-lg border text-left text-sm flex items-center justify-between"
                >
                  <span className="truncate">{job.title}</span>
                  <StatusBadge status={job.status} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Delete Button */}
        <Button
          variant="outline"
          className="w-full text-destructive hover:text-destructive"
          onClick={handleDelete}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete Client
        </Button>
      </div>
    </MobileLayout>
  );
}
