import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Repeat, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface RecurringInvoiceHistoryProps {
  parentInvoiceId: string;
}

interface GeneratedInvoice {
  id: string;
  invoice_number: string;
  created_at: string;
  status: string;
  total: number;
}

export function RecurringInvoiceHistory({ parentInvoiceId }: RecurringInvoiceHistoryProps) {
  const navigate = useNavigate();
  const [history, setHistory] = useState<GeneratedInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, [parentInvoiceId]);

  const fetchHistory = async () => {
    const { data, error } = await supabase
      .from('invoices')
      .select('id, invoice_number, created_at, status, total')
      .eq('parent_invoice_id', parentInvoiceId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setHistory(data);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (history.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 p-4 bg-muted/30 rounded-xl border">
      <div className="flex items-center gap-2">
        <Repeat className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Generated Invoices ({history.length})</h3>
      </div>

      <div className="space-y-2">
        {history.map((invoice) => (
          <div
            key={invoice.id}
            className="flex items-center justify-between p-3 bg-background rounded-lg border hover:border-primary/50 transition-colors"
          >
            <div className="space-y-1 flex-1">
              <p className="font-medium text-sm">{invoice.invoice_number}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(invoice.created_at), 'MMM dd, yyyy')}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={invoice.status} />
              <p className="font-semibold text-sm min-w-[80px] text-right">
                ${invoice.total?.toFixed(2)}
              </p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => navigate(`/invoices/${invoice.id}`)}
                className="shrink-0"
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center pt-2">
        These invoices were automatically generated from this recurring template
      </p>
    </div>
  );
}
