import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Receipt, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export default function Invoices() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchInvoices();
  }, [user]);

  const fetchInvoices = async () => {
    const { data } = await supabase
      .from('invoices')
      .select('*, clients(name)')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });
    setInvoices(data || []);
    setLoading(false);
  };

  return (
    <MobileLayout>
      <PageHeader 
        title="Invoices"
        subtitle={`${invoices.length} total`}
        action={{
          label: "New Invoice",
          onClick: () => navigate('/invoices/new'),
        }}
      />
      
      <div className="p-4 animate-fade-in">
        {invoices.length === 0 && !loading ? (
          <EmptyState
            icon={<Receipt className="w-8 h-8" />}
            title="No invoices yet"
            description="Create invoices from completed quotes and jobs."
            action={{
              label: "Create Invoice",
              onClick: () => navigate('/invoices/new'),
            }}
          />
        ) : (
          <div className="space-y-2">
            {invoices.map((invoice) => (
              <button
                key={invoice.id}
                onClick={() => navigate(`/invoices/${invoice.id}`)}
                className="w-full p-4 bg-card rounded-xl border text-left hover:bg-muted/50 transition-smooth"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{invoice.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {invoice.clients?.name || 'No client'} • {invoice.invoice_number}
                    </p>
                  </div>
                  <StatusBadge status={invoice.status} />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-lg font-bold">${Number(invoice.total).toLocaleString()}</span>
                  {invoice.due_date && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5" />
                      Due {format(new Date(invoice.due_date), 'd MMM')}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
